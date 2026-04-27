use std::sync::Arc;

use solana_pubkey::Pubkey;
use solana_rpc_client::rpc_client::RpcClient;
use solana_transaction::versioned::VersionedTransaction;
use std::str::FromStr;

use crate::{
    error::Error,
    protocol::schemes::exact::{
        caip2_network_for_cluster, cluster_for_caip2_network, default_rpc_url, fetch_transaction,
        verify_exact_versioned_transaction, verify_transaction_details, PaymentConfig,
        PaymentProof, PaymentRequiredEnvelope, PaymentRequirements, PaymentSignatureEnvelope,
        EXACT_SCHEME,
    },
    PAYMENT_REQUIRED_HEADER, PAYMENT_SIGNATURE_HEADER, X402_VERSION_V1, X402_VERSION_V2,
};

/// Server configuration for Solana x402 `exact`.
#[derive(Debug, Clone)]
pub struct Config {
    pub recipient: String,
    pub currency: String,
    pub decimals: u8,
    pub network: String,
    pub rpc_url: Option<String>,
    pub resource: String,
    pub description: Option<String>,
    pub max_age: Option<u64>,
    pub token_program: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            recipient: String::new(),
            currency: "USDC".to_string(),
            decimals: 6,
            network: "mainnet-beta".to_string(),
            rpc_url: None,
            resource: String::new(),
            description: None,
            max_age: None,
            token_program: None,
        }
    }
}

/// Options for generating an `exact` payment requirement.
#[derive(Debug, Clone, Default)]
pub struct ExactOptions<'a> {
    pub description: Option<&'a str>,
    pub resource: Option<&'a str>,
    pub max_age: Option<u64>,
}

/// Parsed and validated x402 payment proof for the Solana `exact` scheme.
#[derive(Debug)]
pub enum VerifiedExactPayment {
    Transaction(VersionedTransaction),
    Signature(String),
}

/// Server-side payment handler for Solana x402.
#[derive(Clone)]
pub struct X402 {
    rpc: Arc<RpcClient>,
    config: Config,
}

impl X402 {
    pub fn new(config: Config) -> Result<Self, Error> {
        if config.recipient.is_empty() {
            return Err(Error::Other("recipient is required".into()));
        }
        Pubkey::from_str(&config.recipient)
            .map_err(|e| Error::Other(format!("Invalid recipient pubkey: {e}")))?;

        let rpc_url = config
            .rpc_url
            .clone()
            .unwrap_or_else(|| default_rpc_url(&config.network).to_string());

        Ok(Self {
            rpc: Arc::new(RpcClient::new(rpc_url)),
            config,
        })
    }

    pub fn recipient(&self) -> &str {
        &self.config.recipient
    }

    pub fn currency(&self) -> &str {
        &self.config.currency
    }

    pub fn decimals(&self) -> u8 {
        self.config.decimals
    }

    pub fn network(&self) -> &str {
        &self.config.network
    }

    pub fn rpc_url(&self) -> String {
        self.config
            .rpc_url
            .clone()
            .unwrap_or_else(|| default_rpc_url(&self.config.network).to_string())
    }

    pub fn exact(&self, amount: &str) -> Result<PaymentRequiredEnvelope, Error> {
        self.exact_with_options(amount, ExactOptions::default())
    }

    pub fn exact_with_options(
        &self,
        amount: &str,
        options: ExactOptions<'_>,
    ) -> Result<PaymentRequiredEnvelope, Error> {
        let requirements = self.exact_requirements(amount, options)?;
        Ok(PaymentRequiredEnvelope {
            x402_version: X402_VERSION_V2,
            resource: requirements.resource_info(),
            accepts: vec![requirements],
            error: None,
            extensions: None,
        })
    }

    pub fn exact_requirements(
        &self,
        amount: &str,
        options: ExactOptions<'_>,
    ) -> Result<PaymentRequirements, Error> {
        let base_units = parse_units(amount, self.config.decimals)?;
        let cluster = cluster_for_caip2_network(&self.config.network)
            .map(|_| self.config.network.as_str())
            .unwrap_or(self.config.network.as_str());

        let payment_config = PaymentConfig {
            recipient: self.config.recipient.clone(),
            cluster: cluster.to_string(),
            rpc_url: self.config.rpc_url.clone(),
            currency: self.config.currency.clone(),
            decimals: Some(self.config.decimals),
            token_program: self.config.token_program.clone(),
            amount: base_units,
            resource: options
                .resource
                .map(str::to_string)
                .unwrap_or_else(|| self.config.resource.clone()),
            description: options
                .description
                .map(str::to_string)
                .or_else(|| self.config.description.clone()),
            max_age: options.max_age.or(self.config.max_age),
        };

        let mut requirements = payment_config.to_requirements();
        requirements.network = caip2_network_for_cluster(cluster).to_string();
        requirements.cluster = Some(cluster.to_string());
        Ok(requirements)
    }

    pub fn payment_required_header(
        &self,
        amount: &str,
        options: ExactOptions<'_>,
    ) -> Result<(String, String), Error> {
        let envelope = self.exact_with_options(amount, options)?;
        let json = serde_json::to_string(&envelope)
            .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;
        Ok((
            PAYMENT_REQUIRED_HEADER.to_string(),
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, json.as_bytes()),
        ))
    }

    pub fn parse_payment_signature(&self, header: &str) -> Result<PaymentSignatureEnvelope, Error> {
        let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, header)
            .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;
        let envelope: PaymentSignatureEnvelope = serde_json::from_slice(&decoded)
            .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;

        let expected_network = caip2_network_for_cluster(&self.config.network);

        match envelope.x402_version {
            X402_VERSION_V1 => {
                let scheme = envelope.scheme.as_deref().unwrap_or_default();
                if scheme != EXACT_SCHEME {
                    return Err(Error::InvalidPayloadType(scheme.to_string()));
                }
                let network = envelope.network.as_deref().unwrap_or_default();
                if caip2_network_for_cluster(network) != expected_network {
                    return Err(Error::Other(format!(
                        "Network mismatch: expected {expected_network}, got {network}"
                    )));
                }
            }
            X402_VERSION_V2 => {
                let accepted = envelope
                    .accepted
                    .as_ref()
                    .ok_or_else(|| Error::InvalidPaymentRequired("missing accepted".to_string()))?;
                let requirements: PaymentRequirements = serde_json::from_value(accepted.clone())
                    .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;
                if requirements.network != expected_network {
                    return Err(Error::Other(format!(
                        "Network mismatch: expected {expected_network}, got {}",
                        requirements.network
                    )));
                }
            }
            other => {
                return Err(Error::InvalidPaymentRequired(format!(
                    "Unsupported x402 version: {other}"
                )));
            }
        }

        Ok(envelope)
    }

    pub async fn verify_payment_signature(
        &self,
        header: &str,
    ) -> Result<VerifiedExactPayment, Error> {
        let envelope = self.parse_payment_signature(header)?;
        let requirements = self.requirements_for_envelope(&envelope)?;
        self.verify_envelope_payload(envelope, &requirements).await
    }

    pub async fn verify_payment_signature_for_requirements(
        &self,
        header: &str,
        requirements: &PaymentRequirements,
    ) -> Result<VerifiedExactPayment, Error> {
        let envelope = self.parse_payment_signature(header)?;
        self.verify_envelope_payload(envelope, requirements).await
    }

    pub fn payment_signature_header_name(&self) -> &'static str {
        PAYMENT_SIGNATURE_HEADER
    }

    async fn verify_envelope_payload(
        &self,
        envelope: PaymentSignatureEnvelope,
        requirements: &PaymentRequirements,
    ) -> Result<VerifiedExactPayment, Error> {
        if let Some(accepted) = &envelope.accepted {
            let accepted_requirements: PaymentRequirements =
                serde_json::from_value(accepted.clone())
                    .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;
            if accepted_requirements.network != requirements.network {
                return Err(Error::Other(format!(
                    "Network mismatch: expected {}, got {}",
                    requirements.network, accepted_requirements.network
                )));
            }
        }

        match envelope.payload {
            PaymentProof::Transaction { transaction } => {
                let decoded =
                    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, transaction)
                        .map_err(|e| Error::Other(format!("Invalid transaction payload: {e}")))?;
                let tx: VersionedTransaction = bincode::deserialize(&decoded)
                    .map_err(|e| Error::Other(format!("Invalid transaction payload: {e}")))?;
                let managed_signers = managed_signers_for_requirements(requirements)?;
                verify_exact_versioned_transaction(&tx, requirements, &managed_signers)?;
                Ok(VerifiedExactPayment::Transaction(tx))
            }
            PaymentProof::Signature { signature } => {
                let tx = fetch_transaction(&self.rpc, &signature)?;
                verify_transaction_details(&tx, requirements)?;
                Ok(VerifiedExactPayment::Signature(signature))
            }
        }
    }

    fn requirements_for_envelope(
        &self,
        envelope: &PaymentSignatureEnvelope,
    ) -> Result<PaymentRequirements, Error> {
        if envelope.x402_version == X402_VERSION_V2 {
            let accepted = envelope
                .accepted
                .as_ref()
                .ok_or_else(|| Error::InvalidPaymentRequired("missing accepted".to_string()))?;
            let mut requirements: PaymentRequirements = serde_json::from_value(accepted.clone())
                .map_err(|e| Error::InvalidPaymentRequired(e.to_string()))?;
            if let Some(resource) = &envelope.resource {
                requirements.resource_info = Some(resource.clone());
                requirements.resource = resource.url.clone();
                requirements.description = resource.description.clone();
            }
            return Ok(requirements);
        }

        self.exact_requirements("0", ExactOptions::default())
    }
}

fn managed_signers_for_requirements(
    requirements: &PaymentRequirements,
) -> Result<Vec<Pubkey>, Error> {
    requirements
        .fee_payer_key
        .as_deref()
        .map(|fee_payer| {
            Pubkey::from_str(fee_payer)
                .map(|key| vec![key])
                .map_err(|e| Error::Other(format!("Invalid fee payer: {e}")))
        })
        .unwrap_or_else(|| Ok(Vec::new()))
}

fn parse_units(amount: &str, decimals: u8) -> Result<String, Error> {
    if amount.is_empty() {
        return Err(Error::Other("amount is required".into()));
    }
    if amount.starts_with('-') {
        return Err(Error::Other("amount must be non-negative".into()));
    }

    let mut parts = amount.split('.');
    let whole = parts.next().unwrap_or_default();
    let fractional = parts.next();
    if parts.next().is_some() {
        return Err(Error::Other(format!("Invalid amount: {amount}")));
    }

    if !whole.chars().all(|c| c.is_ascii_digit()) {
        return Err(Error::Other(format!("Invalid amount: {amount}")));
    }

    let fractional = fractional.unwrap_or_default();
    if !fractional.chars().all(|c| c.is_ascii_digit()) {
        return Err(Error::Other(format!("Invalid amount: {amount}")));
    }
    if fractional.len() > decimals as usize {
        return Err(Error::Other(format!(
            "Too many decimal places for amount: {amount}"
        )));
    }

    let mut units = whole.to_string();
    units.push_str(fractional);
    while units.len() < whole.len() + decimals as usize {
        units.push('0');
    }

    let normalized = units.trim_start_matches('0');
    Ok(if normalized.is_empty() {
        "0".to_string()
    } else {
        normalized.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        protocol::schemes::exact::{
            PaymentProof, PaymentSignatureEnvelope, EXACT_SCHEME, SOLANA_DEVNET,
        },
        X402_VERSION_V1, X402_VERSION_V2,
    };
    use solana_hash::Hash;
    use solana_message::Message;
    use solana_pubkey::Pubkey;
    use solana_system_interface::instruction as system_instruction;
    use solana_transaction::versioned::VersionedTransaction;
    use solana_transaction::Transaction;

    fn config() -> Config {
        Config {
            recipient: "CXhrFZJLKqjzmP3sjYLcF4dTeXWKCy9e2SXXZ2Yo6MPY".to_string(),
            currency: "USDC".to_string(),
            decimals: 6,
            network: "devnet".to_string(),
            rpc_url: Some("http://localhost:8899".to_string()),
            resource: "/fortune".to_string(),
            description: Some("Fortune".to_string()),
            max_age: Some(60),
            token_program: None,
        }
    }

    #[test]
    fn exact_builds_payment_required_envelope() {
        let x402 = X402::new(config()).unwrap();
        let envelope = x402.exact("1.25").unwrap();
        let req = &envelope.accepts[0];

        assert_eq!(envelope.x402_version, X402_VERSION_V2);
        assert_eq!(
            envelope.resource.as_ref().map(|r| r.url.as_str()),
            Some("/fortune")
        );
        assert_eq!(req.amount, "1250000");
        assert_eq!(req.currency, "USDC");
        assert_eq!(req.network, SOLANA_DEVNET);
        assert_eq!(req.resource, "/fortune");
    }

    #[test]
    fn constructor_and_accessors_work() {
        let cfg = config();
        let x402 = X402::new(cfg.clone()).unwrap();
        assert_eq!(x402.recipient(), cfg.recipient);
        assert_eq!(x402.currency(), cfg.currency);
        assert_eq!(x402.decimals(), cfg.decimals);
        assert_eq!(x402.network(), cfg.network);
        assert_eq!(x402.rpc_url(), cfg.rpc_url.unwrap());
    }

    #[test]
    fn constructor_rejects_invalid_recipient() {
        let mut cfg = config();
        cfg.recipient = "bad-recipient".to_string();
        assert!(X402::new(cfg).is_err());
    }

    #[test]
    fn exact_with_options_overrides_defaults() {
        let x402 = X402::new(config()).unwrap();
        let envelope = x402
            .exact_with_options(
                "2.0",
                ExactOptions {
                    description: Some("Override"),
                    resource: Some("/override"),
                    max_age: Some(120),
                },
            )
            .unwrap();
        let req = &envelope.accepts[0];
        assert_eq!(req.amount, "2000000");
        assert_eq!(req.description.as_deref(), Some("Override"));
        assert_eq!(req.resource, "/override");
        assert_eq!(req.max_age, Some(120));
    }

    #[test]
    fn exact_rejects_invalid_amounts() {
        let x402 = X402::new(config()).unwrap();
        assert!(x402.exact("").is_err());
        assert!(x402.exact("-1").is_err());
        assert!(x402.exact("abc").is_err());
        assert!(x402.exact("1.0000001").is_err());
    }

    #[test]
    fn exact_header_is_base64_json() {
        let x402 = X402::new(config()).unwrap();
        let (name, value) = x402
            .payment_required_header("0.5", ExactOptions::default())
            .unwrap();
        assert_eq!(name, PAYMENT_REQUIRED_HEADER);

        let decoded =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, value).unwrap();
        let envelope: PaymentRequiredEnvelope = serde_json::from_slice(&decoded).unwrap();
        assert_eq!(envelope.accepts[0].amount, "500000");
    }

    #[test]
    fn parse_units_handles_edges() {
        assert_eq!(parse_units("0", 6).unwrap(), "0");
        assert_eq!(parse_units("1", 6).unwrap(), "1000000");
        assert_eq!(parse_units("1.5", 6).unwrap(), "1500000");
        assert_eq!(parse_units("0.000001", 6).unwrap(), "1");
        assert!(parse_units("1.2.3", 6).is_err());
        assert!(parse_units("-1", 6).is_err());
        assert!(parse_units("1.0000001", 6).is_err());
    }

    #[test]
    fn parse_payment_header_checks_scheme_and_network() {
        let x402 = X402::new(config()).unwrap();
        let envelope = PaymentSignatureEnvelope {
            scheme: Some(EXACT_SCHEME.to_string()),
            network: Some(SOLANA_DEVNET.to_string()),
            x402_version: X402_VERSION_V1,
            accepted: None,
            resource: None,
            payload: PaymentProof::Signature {
                signature: "sig".to_string(),
            },
        };
        let header = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );

        let parsed = x402.parse_payment_signature(&header).unwrap();
        assert_eq!(parsed.scheme.as_deref(), Some(EXACT_SCHEME));
        assert_eq!(
            x402.payment_signature_header_name(),
            PAYMENT_SIGNATURE_HEADER
        );
    }

    #[test]
    fn parse_payment_signature_rejects_invalid_inputs() {
        let x402 = X402::new(config()).unwrap();
        assert!(x402.parse_payment_signature("%%%").is_err());

        let bad_json =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b"not-json");
        assert!(x402.parse_payment_signature(&bad_json).is_err());

        let wrong_scheme = PaymentSignatureEnvelope {
            scheme: Some("session".to_string()),
            network: Some(SOLANA_DEVNET.to_string()),
            x402_version: X402_VERSION_V1,
            accepted: None,
            resource: None,
            payload: PaymentProof::Signature {
                signature: "sig".to_string(),
            },
        };
        let wrong_scheme = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&wrong_scheme).unwrap(),
        );
        assert!(x402.parse_payment_signature(&wrong_scheme).is_err());
    }

    #[tokio::test]
    async fn verify_transaction_header_rejects_non_exact_transaction() {
        let x402 = X402::new(config()).unwrap();
        let payer = Pubkey::new_unique();
        let recipient = Pubkey::new_unique();
        let ix = system_instruction::transfer(&payer, &recipient, 1000);
        let message =
            Message::new_with_blockhash(&[ix], Some(&payer), &Hash::new_from_array([9u8; 32]));
        let tx = Transaction::new_unsigned(message);
        let envelope = PaymentSignatureEnvelope {
            scheme: Some(EXACT_SCHEME.to_string()),
            network: Some(SOLANA_DEVNET.to_string()),
            x402_version: X402_VERSION_V1,
            accepted: None,
            resource: None,
            payload: PaymentProof::Transaction {
                transaction: base64::Engine::encode(
                    &base64::engine::general_purpose::STANDARD,
                    bincode::serialize(&VersionedTransaction::from(tx)).unwrap(),
                ),
            },
        };
        let header = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );

        assert!(x402.verify_payment_signature(&header).await.is_err());
    }

    #[tokio::test]
    async fn verify_payment_signature_rejects_invalid_transaction_payload() {
        let x402 = X402::new(config()).unwrap();
        let envelope = PaymentSignatureEnvelope {
            scheme: Some(EXACT_SCHEME.to_string()),
            network: Some(SOLANA_DEVNET.to_string()),
            x402_version: X402_VERSION_V1,
            accepted: None,
            resource: None,
            payload: PaymentProof::Transaction {
                transaction: "%%%".to_string(),
            },
        };
        let header = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );
        assert!(x402.verify_payment_signature(&header).await.is_err());
    }

    #[tokio::test]
    async fn verify_payment_signature_rejects_invalid_signature_before_rpc() {
        let x402 = X402::new(config()).unwrap();
        let envelope = PaymentSignatureEnvelope {
            scheme: Some(EXACT_SCHEME.to_string()),
            network: Some(SOLANA_DEVNET.to_string()),
            x402_version: X402_VERSION_V1,
            accepted: None,
            resource: None,
            payload: PaymentProof::Signature {
                signature: "not-a-signature".to_string(),
            },
        };
        let header = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );
        assert!(x402.verify_payment_signature(&header).await.is_err());
    }
}

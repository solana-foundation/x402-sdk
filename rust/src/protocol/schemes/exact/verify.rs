use std::str::FromStr;

use solana_message::compiled_instruction::CompiledInstruction;
use solana_pubkey::Pubkey;
use solana_rpc_client::rpc_client::RpcClient;
use solana_signature::Signature;
use solana_transaction::versioned::VersionedTransaction;
use solana_transaction::Transaction;
use solana_transaction_status::{EncodedConfirmedTransactionWithStatusMeta, UiTransactionEncoding};

use super::{programs, resolve_stablecoin_mint, PaymentRequirements};
use crate::error::Error;

const MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS: u64 = 5_000_000;

/// Verify a confirmed transaction matches the expected payment requirements.
pub fn verify_transaction_details(
    tx: &EncodedConfirmedTransactionWithStatusMeta,
    requirements: &PaymentRequirements,
) -> Result<(), Error> {
    // Check for on-chain error.
    if let Some(meta) = &tx.transaction.meta {
        if meta.err.is_some() {
            return Err(Error::TransactionFailed(format!("{:?}", meta.err)));
        }
    }

    let _total_amount: u64 = requirements
        .amount
        .parse()
        .map_err(|_| Error::Other(format!("Invalid amount: {}", requirements.amount)))?;

    // TODO: Parse jsonParsed instructions from the encoded transaction
    // and verify SOL/SPL transfers match expected amounts and recipients.
    let _ = &requirements.recipient;

    Ok(())
}

/// Verify a signed `exact` transaction against Rust payment requirements.
///
/// This mirrors the canonical TypeScript facilitator's transaction-shape checks.
pub fn verify_exact_transaction(
    tx: &Transaction,
    requirements: &PaymentRequirements,
    managed_signers: &[Pubkey],
) -> Result<(), Error> {
    verify_exact_instructions(
        &tx.message.account_keys,
        &tx.message.instructions,
        requirements,
        managed_signers,
    )
}

/// Verify a signed versioned `exact` transaction against payment requirements.
pub fn verify_exact_versioned_transaction(
    tx: &VersionedTransaction,
    requirements: &PaymentRequirements,
    managed_signers: &[Pubkey],
) -> Result<(), Error> {
    verify_exact_instructions(
        tx.message.static_account_keys(),
        tx.message.instructions(),
        requirements,
        managed_signers,
    )
}

fn verify_exact_instructions(
    account_keys: &[Pubkey],
    instructions: &[CompiledInstruction],
    requirements: &PaymentRequirements,
    managed_signers: &[Pubkey],
) -> Result<(), Error> {
    if !(3..=6).contains(&instructions.len()) {
        return invalid("invalid_exact_svm_payload_transaction_instructions_length");
    }

    verify_compute_limit_instruction(
        instructions.first().ok_or_else(|| {
            Error::Other("invalid_exact_svm_payload_transaction_instructions_length".into())
        })?,
        account_keys,
    )?;
    verify_compute_price_instruction(
        instructions.get(1).ok_or_else(|| {
            Error::Other("invalid_exact_svm_payload_transaction_instructions_length".into())
        })?,
        account_keys,
    )?;

    let transfer_ix = instructions.get(2).ok_or_else(|| {
        Error::Other("invalid_exact_svm_payload_transaction_instructions_length".into())
    })?;
    verify_transfer_instruction(transfer_ix, account_keys, requirements, managed_signers)?;

    let invalid_reason_by_index = [
        "invalid_exact_svm_payload_unknown_fourth_instruction",
        "invalid_exact_svm_payload_unknown_fifth_instruction",
        "invalid_exact_svm_payload_unknown_sixth_instruction",
    ];

    for (index, instruction) in instructions.iter().skip(3).enumerate() {
        let program = program_id_for_instruction(instruction, account_keys)?;
        let program = program.to_string();
        if program == programs::LIGHTHOUSE_PROGRAM || program == programs::MEMO_PROGRAM {
            continue;
        }
        return invalid(
            invalid_reason_by_index
                .get(index)
                .copied()
                .unwrap_or("invalid_exact_svm_payload_unknown_optional_instruction"),
        );
    }

    if let Some(expected_memo) = expected_memo(requirements) {
        let memo_instructions: Vec<_> = instructions
            .iter()
            .skip(3)
            .filter(|instruction| {
                program_id_for_instruction(instruction, account_keys)
                    .map(|program| program.to_string() == programs::MEMO_PROGRAM)
                    .unwrap_or(false)
            })
            .collect();

        if memo_instructions.len() != 1 {
            return invalid("invalid_exact_svm_payload_memo_count");
        }

        let actual_memo = std::str::from_utf8(&memo_instructions[0].data)
            .map_err(|_| Error::Other("invalid_exact_svm_payload_memo_mismatch".to_string()))?;
        if actual_memo != expected_memo {
            return invalid("invalid_exact_svm_payload_memo_mismatch");
        }
    }

    Ok(())
}

/// Fetch a confirmed transaction from an RPC endpoint.
pub fn fetch_transaction(
    rpc: &RpcClient,
    signature_str: &str,
) -> Result<EncodedConfirmedTransactionWithStatusMeta, Error> {
    let signature = Signature::from_str(signature_str)
        .map_err(|e| Error::Other(format!("Invalid signature: {e}")))?;

    rpc.get_transaction(&signature, UiTransactionEncoding::JsonParsed)
        .map_err(|e| {
            if e.to_string().contains("not found") {
                Error::TransactionNotFound
            } else {
                Error::Rpc(e.to_string())
            }
        })
}

fn verify_compute_limit_instruction(
    instruction: &CompiledInstruction,
    account_keys: &[Pubkey],
) -> Result<(), Error> {
    let program = program_id_for_instruction(instruction, account_keys)?;
    if program.to_string() != programs::COMPUTE_BUDGET_PROGRAM
        || instruction.data.len() != 5
        || instruction.data.first().copied() != Some(2)
    {
        return invalid(
            "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction",
        );
    }
    Ok(())
}

fn verify_compute_price_instruction(
    instruction: &CompiledInstruction,
    account_keys: &[Pubkey],
) -> Result<(), Error> {
    let program = program_id_for_instruction(instruction, account_keys)?;
    if program.to_string() != programs::COMPUTE_BUDGET_PROGRAM
        || instruction.data.len() != 9
        || instruction.data.first().copied() != Some(3)
    {
        return invalid(
            "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction",
        );
    }

    let micro_lamports = u64::from_le_bytes(instruction.data[1..9].try_into().map_err(|_| {
        Error::Other(
            "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction".into(),
        )
    })?);

    if micro_lamports > MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS {
        return invalid(
            "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high",
        );
    }

    Ok(())
}

fn verify_transfer_instruction(
    instruction: &CompiledInstruction,
    account_keys: &[Pubkey],
    requirements: &PaymentRequirements,
    managed_signers: &[Pubkey],
) -> Result<(), Error> {
    let program = program_id_for_instruction(instruction, account_keys)?;
    let program_str = program.to_string();
    if program_str != programs::TOKEN_PROGRAM && program_str != programs::TOKEN_2022_PROGRAM {
        return invalid("invalid_exact_svm_payload_no_transfer_instruction");
    }

    if instruction.accounts.len() < 4 || instruction.data.len() != 10 || instruction.data[0] != 12 {
        return invalid("invalid_exact_svm_payload_no_transfer_instruction");
    }

    let mint = key_for_account_index(instruction.accounts[1], account_keys)?;
    let destination = key_for_account_index(instruction.accounts[2], account_keys)?;
    let authority = key_for_account_index(instruction.accounts[3], account_keys)?;

    if managed_signers.iter().any(|managed| managed == authority) {
        return invalid("invalid_exact_svm_payload_transaction_fee_payer_transferring_funds");
    }

    let expected_mint = resolve_expected_mint(requirements);
    if mint.to_string() != expected_mint {
        return invalid("invalid_exact_svm_payload_mint_mismatch");
    }

    let expected_destination = get_associated_token_address(
        &Pubkey::from_str(&requirements.pay_to_recipient()?)
            .map_err(|e| Error::Other(format!("Invalid recipient: {e}")))?,
        &Pubkey::from_str(&expected_mint)
            .map_err(|e| Error::Other(format!("Invalid mint: {e}")))?,
        program,
    );
    if destination != &expected_destination {
        return invalid("invalid_exact_svm_payload_recipient_mismatch");
    }

    let amount = u64::from_le_bytes(
        instruction.data[1..9]
            .try_into()
            .map_err(|_| Error::Other("invalid_exact_svm_payload_amount_mismatch".into()))?,
    );
    let expected_amount: u64 = requirements
        .amount
        .parse()
        .map_err(|_| Error::Other(format!("Invalid amount: {}", requirements.amount)))?;
    if amount != expected_amount {
        return invalid("invalid_exact_svm_payload_amount_mismatch");
    }

    Ok(())
}

fn key_for_account_index(index: u8, account_keys: &[Pubkey]) -> Result<&Pubkey, Error> {
    account_keys
        .get(index as usize)
        .ok_or_else(|| Error::Other("invalid_exact_svm_payload_no_transfer_instruction".into()))
}

fn program_id_for_instruction<'a>(
    instruction: &CompiledInstruction,
    account_keys: &'a [Pubkey],
) -> Result<&'a Pubkey, Error> {
    account_keys
        .get(instruction.program_id_index as usize)
        .ok_or_else(|| Error::Other("invalid_exact_svm_payload_no_transfer_instruction".into()))
}

fn get_associated_token_address(owner: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Pubkey {
    let ata_program = Pubkey::from_str(programs::ASSOCIATED_TOKEN_PROGRAM).unwrap();
    let seeds = &[owner.as_ref(), token_program.as_ref(), mint.as_ref()];
    Pubkey::find_program_address(seeds, &ata_program).0
}

fn resolve_expected_mint(requirements: &PaymentRequirements) -> String {
    resolve_stablecoin_mint(&requirements.currency, requirements.cluster.as_deref())
        .unwrap_or(&requirements.currency)
        .to_string()
}

fn expected_memo(requirements: &PaymentRequirements) -> Option<&str> {
    requirements
        .extra
        .as_ref()
        .and_then(|extra| extra.get("memo"))
        .and_then(|memo| memo.as_str())
}

fn invalid<T>(reason: &str) -> Result<T, Error> {
    Err(Error::Other(reason.to_string()))
}

trait RequirementsRecipientExt {
    fn pay_to_recipient(&self) -> Result<String, Error>;
}

impl RequirementsRecipientExt for PaymentRequirements {
    fn pay_to_recipient(&self) -> Result<String, Error> {
        Ok(self.recipient.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::schemes::exact::{mints, SOLANA_DEVNET};
    use solana_hash::Hash;
    use solana_instruction::{AccountMeta, Instruction};
    use solana_message::{v0, MessageHeader, VersionedMessage};
    use solana_signature::Signature;
    use solana_transaction::versioned::VersionedTransaction;
    use solana_transaction::Transaction;
    use solana_transaction::TransactionError;
    use solana_transaction_status::{
        option_serializer::OptionSerializer, EncodedTransaction, EncodedTransactionWithStatusMeta,
        UiMessage, UiRawMessage, UiTransaction, UiTransactionStatusMeta,
    };

    fn requirements(amount: &str) -> PaymentRequirements {
        PaymentRequirements {
            network: SOLANA_DEVNET.to_string(),
            cluster: Some("devnet".to_string()),
            recipient: Pubkey::new_unique().to_string(),
            amount: amount.to_string(),
            currency: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU".to_string(),
            decimals: Some(6),
            token_program: Some(programs::TOKEN_PROGRAM.to_string()),
            resource: "/resource".to_string(),
            description: None,
            max_age: None,
            recent_blockhash: None,
            fee_payer: None,
            fee_payer_key: None,
            extra: None,
            accepted: None,
            resource_info: None,
        }
    }

    fn tx_with_meta(err: Option<TransactionError>) -> EncodedConfirmedTransactionWithStatusMeta {
        EncodedConfirmedTransactionWithStatusMeta {
            slot: 1,
            transaction: EncodedTransactionWithStatusMeta {
                transaction: EncodedTransaction::Json(UiTransaction {
                    signatures: vec!["sig".to_string()],
                    message: UiMessage::Raw(UiRawMessage {
                        header: MessageHeader {
                            num_required_signatures: 1,
                            num_readonly_signed_accounts: 0,
                            num_readonly_unsigned_accounts: 1,
                        },
                        account_keys: vec![
                            "payer".to_string(),
                            "recipient".to_string(),
                            "11111111111111111111111111111111".to_string(),
                        ],
                        recent_blockhash: "blockhash".to_string(),
                        instructions: vec![],
                        address_table_lookups: None,
                    }),
                }),
                meta: Some(UiTransactionStatusMeta {
                    err: err.clone().map(Into::into),
                    status: err.map_or(Ok(()), |e| Err(e.into())),
                    fee: 5000,
                    pre_balances: vec![10_000, 0, 0],
                    post_balances: vec![5_000, 5_000, 0],
                    inner_instructions: OptionSerializer::None,
                    log_messages: OptionSerializer::None,
                    pre_token_balances: OptionSerializer::None,
                    post_token_balances: OptionSerializer::None,
                    rewards: OptionSerializer::None,
                    loaded_addresses: OptionSerializer::Skip,
                    return_data: OptionSerializer::Skip,
                    compute_units_consumed: OptionSerializer::Skip,
                    cost_units: OptionSerializer::Skip,
                }),
                version: None,
            },
            block_time: None,
        }
    }

    fn compute_limit_ix() -> Instruction {
        Instruction {
            program_id: Pubkey::from_str(programs::COMPUTE_BUDGET_PROGRAM).unwrap(),
            accounts: vec![],
            data: [vec![2], 20_000u32.to_le_bytes().to_vec()].concat(),
        }
    }

    fn compute_price_ix(microlamports: u64) -> Instruction {
        Instruction {
            program_id: Pubkey::from_str(programs::COMPUTE_BUDGET_PROGRAM).unwrap(),
            accounts: vec![],
            data: [vec![3], microlamports.to_le_bytes().to_vec()].concat(),
        }
    }

    fn memo_ix() -> Instruction {
        Instruction {
            program_id: Pubkey::from_str(programs::MEMO_PROGRAM).unwrap(),
            accounts: vec![],
            data: b"deadbeef".to_vec(),
        }
    }

    fn unknown_ix() -> Instruction {
        Instruction {
            program_id: Pubkey::new_unique(),
            accounts: vec![],
            data: vec![1],
        }
    }

    fn transfer_checked_ix(
        owner: &Pubkey,
        requirements: &PaymentRequirements,
        amount: u64,
        destination_override: Option<Pubkey>,
        mint_override: Option<Pubkey>,
    ) -> Instruction {
        let mint =
            mint_override.unwrap_or_else(|| Pubkey::from_str(&requirements.currency).unwrap());
        let token_program =
            Pubkey::from_str(requirements.token_program.as_deref().unwrap()).unwrap();
        let destination = destination_override.unwrap_or_else(|| {
            get_associated_token_address(
                &Pubkey::from_str(&requirements.recipient).unwrap(),
                &mint,
                &token_program,
            )
        });
        let source = get_associated_token_address(owner, &mint, &token_program);

        let mut data = vec![12u8];
        data.extend_from_slice(&amount.to_le_bytes());
        data.push(requirements.decimals.unwrap_or(6));

        Instruction {
            program_id: token_program,
            accounts: vec![
                AccountMeta::new(source, false),
                AccountMeta::new_readonly(mint, false),
                AccountMeta::new(destination, false),
                AccountMeta::new_readonly(*owner, true),
            ],
            data,
        }
    }

    fn build_exact_transaction(
        requirements: &PaymentRequirements,
        owner: &Pubkey,
        transfer_owner: &Pubkey,
        optional_ixs: Vec<Instruction>,
        amount: u64,
        destination_override: Option<Pubkey>,
        mint_override: Option<Pubkey>,
    ) -> Transaction {
        let mut instructions = vec![
            compute_limit_ix(),
            compute_price_ix(1),
            transfer_checked_ix(
                transfer_owner,
                requirements,
                amount,
                destination_override,
                mint_override,
            ),
        ];
        instructions.extend(optional_ixs);

        Transaction::new_unsigned(solana_message::Message::new_with_blockhash(
            &instructions,
            Some(owner),
            &Hash::new_from_array([9u8; 32]),
        ))
    }

    fn build_exact_versioned_transaction(
        requirements: &PaymentRequirements,
        fee_payer: &Pubkey,
        transfer_owner: &Pubkey,
        optional_ixs: Vec<Instruction>,
    ) -> VersionedTransaction {
        let mut instructions = vec![
            compute_limit_ix(),
            compute_price_ix(1),
            transfer_checked_ix(transfer_owner, requirements, 1000, None, None),
        ];
        instructions.extend(optional_ixs);

        let message = v0::Message::try_compile(
            fee_payer,
            &instructions,
            &[],
            Hash::new_from_array([9u8; 32]),
        )
        .unwrap();
        VersionedTransaction {
            signatures: vec![Signature::default(); message.header.num_required_signatures as usize],
            message: VersionedMessage::V0(message),
        }
    }

    #[test]
    fn verify_transaction_details_accepts_nominal_meta() {
        let tx = tx_with_meta(None);
        assert!(verify_transaction_details(&tx, &requirements("1000")).is_ok());
    }

    #[test]
    fn verify_transaction_details_accepts_missing_meta() {
        let mut tx = tx_with_meta(None);
        tx.transaction.meta = None;
        assert!(verify_transaction_details(&tx, &requirements("1000")).is_ok());
    }

    #[test]
    fn verify_transaction_details_rejects_onchain_error() {
        let tx = tx_with_meta(Some(TransactionError::AccountInUse));
        let err = verify_transaction_details(&tx, &requirements("1000")).unwrap_err();
        assert!(matches!(err, Error::TransactionFailed(_)));
    }

    #[test]
    fn verify_transaction_details_rejects_invalid_amount() {
        let tx = tx_with_meta(None);
        let err = verify_transaction_details(&tx, &requirements("abc")).unwrap_err();
        assert!(matches!(err, Error::Other(_)));
    }

    #[test]
    fn fetch_transaction_rejects_invalid_signature_before_rpc() {
        let rpc = RpcClient::new("http://localhost:8899".to_string());
        let err = fetch_transaction(&rpc, "not-a-signature").unwrap_err();
        assert!(matches!(err, Error::Other(_)));
    }

    #[test]
    fn verify_exact_transaction_accepts_nominal_shape() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![memo_ix()],
            1000,
            None,
            None,
        );
        assert!(verify_exact_transaction(&tx, &requirements, &[fee_payer]).is_ok());
    }

    #[test]
    fn verify_exact_versioned_transaction_accepts_v0_shape() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx =
            build_exact_versioned_transaction(&requirements, &fee_payer, &owner, vec![memo_ix()]);

        assert!(verify_exact_versioned_transaction(&tx, &requirements, &[fee_payer]).is_ok());
    }

    #[test]
    fn verify_exact_transaction_accepts_usdt_symbol() {
        let mut requirements = requirements("1000");
        requirements.currency = "USDT".to_string();
        requirements.cluster = Some("mainnet-beta".to_string());

        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![memo_ix()],
            1000,
            None,
            Some(Pubkey::from_str(mints::USDT_MAINNET).unwrap()),
        );

        assert!(verify_exact_transaction(&tx, &requirements, &[fee_payer]).is_ok());
    }

    #[test]
    fn verify_exact_transaction_accepts_pyusd_and_cash_symbols() {
        let mut pyusd = requirements("1000");
        pyusd.currency = "PYUSD".to_string();
        pyusd.cluster = Some(SOLANA_DEVNET.to_string());
        assert_eq!(resolve_expected_mint(&pyusd), mints::PYUSD_DEVNET);

        let mut cash = requirements("1000");
        cash.currency = "CASH".to_string();
        assert_eq!(resolve_expected_mint(&cash), mints::CASH_MAINNET);
    }

    #[test]
    fn verify_exact_transaction_enforces_expected_memo() {
        let mut requirements = requirements("1000");
        requirements.extra = Some(serde_json::json!({ "memo": "deadbeef" }));
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![memo_ix()],
            1000,
            None,
            None,
        );

        assert!(verify_exact_transaction(&tx, &requirements, &[fee_payer]).is_ok());

        requirements.extra = Some(serde_json::json!({ "memo": "expected" }));
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_memo_mismatch")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_missing_expected_memo() {
        let mut requirements = requirements("1000");
        requirements.extra = Some(serde_json::json!({ "memo": "required" }));
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 1000, None, None);

        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_memo_count")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_instruction_length() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let tx = Transaction::new_unsigned(solana_message::Message::new_with_blockhash(
            &[compute_limit_ix(), compute_price_ix(1)],
            Some(&fee_payer),
            &Hash::new_from_array([9u8; 32]),
        ));
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_transaction_instructions_length")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_bad_compute_limit() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let mut tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 1000, None, None);
        tx.message.instructions[0].data = vec![9];
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_bad_compute_price() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let mut tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 1000, None, None);
        tx.message.instructions[1].data = vec![3];
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_compute_price_too_high() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let mut tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 1000, None, None);
        tx.message.instructions[1].data = [
            vec![3],
            (MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS + 1)
                .to_le_bytes()
                .to_vec(),
        ]
        .concat();
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_unknown_transfer_program() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let mut tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 1000, None, None);
        tx.message.instructions[2].program_id_index = 0;
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_no_transfer_instruction")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_managed_fee_payer_transferring_funds() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &fee_payer,
            vec![],
            1000,
            None,
            None,
        );
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_mint_mismatch() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![],
            1000,
            None,
            Some(Pubkey::new_unique()),
        );
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_mint_mismatch")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_recipient_mismatch() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![],
            1000,
            Some(Pubkey::new_unique()),
            None,
        );
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_recipient_mismatch")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_amount_mismatch() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx =
            build_exact_transaction(&requirements, &fee_payer, &owner, vec![], 999, None, None);
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_amount_mismatch")
        );
    }

    #[test]
    fn verify_exact_transaction_rejects_unknown_optional_instruction() {
        let requirements = requirements("1000");
        let fee_payer = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let tx = build_exact_transaction(
            &requirements,
            &fee_payer,
            &owner,
            vec![unknown_ix()],
            1000,
            None,
            None,
        );
        let err = verify_exact_transaction(&tx, &requirements, &[fee_payer]).unwrap_err();
        assert!(
            matches!(err, Error::Other(reason) if reason == "invalid_exact_svm_payload_unknown_fourth_instruction")
        );
    }
}

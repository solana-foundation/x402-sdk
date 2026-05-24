package = "x402-sdk-svm"
version = "0.0.0-1"
source = {
  url = "git://github.com/solana-foundation/x402-sdk"
}
description = {
  summary = "Experimental Lua scaffold for Solana x402 server-side interop adapters",
  license = "Apache-2.0"
}
dependencies = {
  "lua >= 5.4",
  "luasocket",
  "luasec",
  "dkjson",
  "luasodium",
  "luazen"
}
build = {
  type = "builtin",
  modules = {}
}

import { JayZ } from "@ginger.io/jay-z"

export type JayZConfig = {
  client: JayZ
  encryptionBlacklist: Set<string>
}

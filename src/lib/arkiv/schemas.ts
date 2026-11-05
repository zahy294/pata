import { bytes, defineSchema } from "@arkiv-network/sdk/schema";
import { ARKIV_SCHEMAS } from "../../../shared/constants";

export const homeSchema = defineSchema(ARKIV_SCHEMAS.home, { sealed: bytes() });
export const voiceSchema = defineSchema(ARKIV_SCHEMAS.voice, { sealed: bytes() });
export const grantSchema = defineSchema(ARKIV_SCHEMAS.grant, { payload: bytes(), index: bytes() });
export const historySchema = defineSchema(ARKIV_SCHEMAS.history, { sealed: bytes() });

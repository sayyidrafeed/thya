export {
  CAMPAIGNS_PER_DAY,
  checkPromoEmail,
  composeEmailText,
  MAX_BODY_CHARS,
  MAX_SUBJECT_CHARS,
  promoEmailSchema,
  SES_SEND_INTERVAL_MS,
  type ContentCheck,
  type PromoEmail,
} from "./content";

export {
  createSesClient,
  SES_REGION,
  type AwsCredentials,
  type OutgoingEmail,
  type SendResult,
  type SesClient,
  type SesFailure,
} from "./ses";

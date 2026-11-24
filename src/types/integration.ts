import type {
	CompleteCustomer,
	CreateConnection,
	IntegrationConnectionCreated as IntegrationConnectionCreatedSchema,
	IntegrationConnection as IntegrationConnectionSchema,
	IntegrationEvent as IntegrationEventSchema,
	IntegrationOperationRetry as IntegrationOperationRetrySchema,
	IntegrationOperation as IntegrationOperationSchema,
	IntegrationProvider as IntegrationProviderSchema,
	IntegrationRuleInput as IntegrationRuleInputSchema,
	IntegrationRule as IntegrationRuleSchema,
} from "./openapi";

export type IntegrationProvider = IntegrationProviderSchema;
export type IntegrationConnection = IntegrationConnectionSchema;
/** Returned once, when the connection is created: `secrets` is never shown again. */
export type IntegrationConnectionCreated = IntegrationConnectionCreatedSchema;
export type IntegrationConnectionCreateParams = CreateConnection;
export type IntegrationRule = IntegrationRuleSchema;
export type IntegrationRuleInput = IntegrationRuleInputSchema;
export type IntegrationEvent = IntegrationEventSchema;
export type IntegrationOperation = IntegrationOperationSchema;
export type IntegrationOperationRetry = IntegrationOperationRetrySchema;
export type IntegrationCompleteCustomerParams = CompleteCustomer;

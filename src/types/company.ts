import type {
	AccountantSend,
	AccountantSendResult,
	AccountantSettings,
	AccountantSettingsUpdate,
	CompanyAddress,
	Company as CompanySchema,
	CreateCompany,
	CreateServiceFavorite,
	CreateServiceTaxProfile,
	DpsSequence as DpsSequenceSchema,
	FiscalProfile as FiscalProfileSchema,
	SendAccountantPackage,
	ServiceFavorite as ServiceFavoriteSchema,
	ServiceTaxProfile as ServiceTaxProfileSchema,
	SetDpsSequence,
	UpdateAccountantPackage,
	UpdateCompany,
	UpdateServiceTaxProfile,
	UpsertFiscalProfile,
} from "./openapi";

export type TaxRegime = CreateCompany["taxRegime"];

export type CompanyAddressInput = CompanyAddress;
export type CompanyCreateParams = CreateCompany;
export type CompanyUpdateParams = UpdateCompany;

/** Optional fields are absent from the JSON when they have no value. */
export type Company = CompanySchema;

export type AccountantSettingsResult = AccountantSettings;
export type AccountantSettingsUpdateResult = AccountantSettingsUpdate;
export type AccountantUpdateParams = UpdateAccountantPackage;
export type AccountantSendParams = SendAccountantPackage;
export type AccountantSendOutcome = AccountantSendResult;
export type AccountantSendRecord = AccountantSend;

export type DpsSequence = DpsSequenceSchema;
export type DpsSequenceSetParams = SetDpsSequence;

export type FiscalProfile = FiscalProfileSchema;
export type FiscalProfileUpsertParams = UpsertFiscalProfile;

export type ServiceTaxProfile = ServiceTaxProfileSchema;
export type ServiceTaxProfileCreateParams = CreateServiceTaxProfile;
export type ServiceTaxProfileUpdateParams = UpdateServiceTaxProfile;

export type ServiceFavorite = ServiceFavoriteSchema;
export type ServiceFavoriteCreateParams = CreateServiceFavorite;

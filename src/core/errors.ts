import { ExitCode } from "./exit-codes.ts";

/** Base for all domain errors. */
export abstract class BeliError extends Error {
	abstract readonly code: ExitCode;
	abstract readonly kind: string;

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = this.constructor.name;
	}
}

export class ValidationError extends BeliError {
	readonly code = ExitCode.ValidationError;
	readonly kind = "validation";

	constructor(
		message: string,
		readonly field?: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

export class AuthRequiredError extends BeliError {
	readonly code = ExitCode.AuthRequired;
	readonly kind = "auth_required";
}

export class UpstreamError extends BeliError {
	readonly code = ExitCode.UpstreamFailure;
	readonly kind = "upstream";

	constructor(
		message: string,
		readonly statusCode?: number,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

export class UnsupportedFeatureError extends BeliError {
	readonly code = ExitCode.UnsupportedFeature;
	readonly kind = "unsupported";
}

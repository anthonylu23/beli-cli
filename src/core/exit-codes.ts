/** Process exit codes. Stable contract for automation consumers. */
export const ExitCode = {
	Success: 0,
	ValidationError: 2,
	AuthRequired: 3,
	UpstreamFailure: 4,
	UnsupportedFeature: 5,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

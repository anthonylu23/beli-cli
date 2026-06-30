# Private Mobile Fixture Notes

These fixtures document the sanitized wire shapes currently supported by the experimental live adapter mappers.

Before checking in captured data:

- Remove tokens, cookies, device identifiers, request IDs, and account-specific headers.
- Replace stable personal identifiers with synthetic IDs such as `user_sanitized_001`.
- Remove personal notes, review text, exact addresses, and precise coordinates.
- Keep only the fields needed to validate mapper behavior.

The live adapter accepts these documented shapes plus common snake_case/camelCase aliases. Missing required normalized fields should fail tests rather than being guessed.

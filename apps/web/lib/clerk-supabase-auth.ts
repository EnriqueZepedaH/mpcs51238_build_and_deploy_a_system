type ClerkTokenOptions = {
  template?: string;
};

type ClerkTokenGetter = (options?: ClerkTokenOptions) => Promise<string | null>;

function getLegacyTemplateName(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_CLERK_SUPABASE_TEMPLATE ??
    process.env.CLERK_SUPABASE_TEMPLATE ??
    undefined
  );
}

export async function getClerkSupabaseAccessToken(
  getToken: ClerkTokenGetter
): Promise<string | null> {
  const template = getLegacyTemplateName();

  try {
    if (template) {
      return getToken({ template });
    }

    return getToken();
  } catch (error) {
    if (
      template &&
      error &&
      typeof error === "object" &&
      "clerkError" in error
    ) {
      throw new Error(
        `Clerk could not find the legacy Supabase JWT template "${template}". Remove CLERK_SUPABASE_TEMPLATE from your env if you are using Supabase Third-Party Auth with Clerk, or create that template in the Clerk dashboard if you are intentionally using the legacy JWT-template flow.`
      );
    }

    throw error;
  }
}

export async function getClerkSupabaseAccessTokenOrThrow(
  getToken: ClerkTokenGetter
): Promise<string> {
  const token = await getClerkSupabaseAccessToken(getToken);

  if (!token) {
    throw new Error(
      "Missing Clerk -> Supabase access token. Configure Supabase Third-Party Auth with Clerk or provide the optional legacy Clerk Supabase JWT template name."
    );
  }

  return token;
}

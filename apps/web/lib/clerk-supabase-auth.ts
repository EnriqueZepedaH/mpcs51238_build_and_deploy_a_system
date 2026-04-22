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

  if (template) {
    return getToken({ template });
  }

  return getToken();
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


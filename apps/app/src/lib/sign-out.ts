type SignOutRequest = () => Promise<{ error?: unknown }>;

export async function requireConfirmedSignOut(signOutRequest: SignOutRequest): Promise<void> {
  const result = await signOutRequest();

  if (result.error) {
    throw new Error("The server did not confirm sign-out.", { cause: result.error });
  }
}

type UserLike = { id: string; role: string } | null | undefined;

export function isAdmin(user?: UserLike) {
  return Boolean(user && user.role === 'ADMIN');
}

export function isReviewer(user?: UserLike) {
  return Boolean(user && user.role === 'REVIEWER');
}

export function canReadDocument(user?: UserLike, docOwnerId?: string | null) {
  if (!user) return false;
  if (isAdmin(user) || isReviewer(user)) return true;
  // regular users may read their own documents
  return Boolean(docOwnerId && user.id === docOwnerId);
}

export function canManageDocuments(user?: UserLike, docOwnerId?: string | null) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  // allow owners to manage their own docs
  return Boolean(docOwnerId && user.id === docOwnerId);
}

export function canManageUsers(user?: UserLike) {
  return Boolean(user && user.role === 'ADMIN');
}

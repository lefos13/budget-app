import type { TranslationFunction } from './translator';

export const API_ERROR_MAP: Record<string, string> = {
  'Email and password are required': 'errors.emailAndPasswordRequired',
  'Invalid email or password': 'errors.invalidCredentials',
  'Failed to log in': 'errors.failedToLogin',
  'Unauthenticated': 'errors.unauthenticated',
  'Failed to retrieve session': 'errors.failedToRetrieveSession',
  'Name is required': 'errors.nameRequired',
  'Name must not exceed 80 characters': 'errors.nameTooLong',
  'Avatar URL must be a valid http or https URL': 'errors.avatarUrlHttp',
  'Avatar URL must be a valid URL': 'errors.invalidAvatarUrl',
  'Invalid avatar URL': 'errors.invalidAvatarUrl',
  'Current password is required': 'errors.currentPasswordRequired',
  'User does not have a password set': 'errors.noPasswordSet',
  'Current password is incorrect': 'errors.wrongCurrentPassword',
  'Password must be at least 6 characters long': 'errors.passwordTooShort',
  'Failed to update profile': 'errors.failedToUpdateProfile',
  'A valid email address is required': 'errors.emailRequired',
  'User with this email already exists': 'errors.emailAlreadyExists',
  'Failed to register user': 'errors.failedToRegister',
  'Invite not found or invalid': 'errors.inviteNotFound',
  'This invitation link has expired': 'errors.inviteExpired',
  'This invitation has reached its usage limit': 'errors.inviteLimitReached',
  'Failed to query invite': 'errors.failedToQueryInvite',
  'Invalid invitation code': 'errors.invalidInviteCode',
  'Authentication required to accept invite': 'errors.authRequired',
  'Failed to accept invite': 'errors.failedToAcceptInvite',
  'Failed to fetch pending invites': 'errors.failedToFetchPendingInvites',
  'Unauthorized': 'errors.unauthorized',
  'Invitation not found': 'errors.inviteNotFound',
  'Invalid action': 'errors.invalidAction',
  'Failed to process invitation action': 'errors.failedToProcessInviteAction',
  'Wallet not found': 'errors.walletNotFound',
  'Only the wallet owner can manage categories': 'errors.onlyOwnerManageCategories',
  'Category not found': 'errors.categoryNotFound',
  'Invalid JSON body': 'errors.invalidJsonBody',
  'Name must be non-empty and at most 40 characters': 'errors.categoryNameLength',
  'A category with this name already exists in this wallet': 'errors.categoryNameExists',
  'Color must match hex format /^#[0-9a-fA-F]{6}$/': 'errors.invalidColorFormat',
  'Icon must be 1-30 alphanumeric characters': 'errors.invalidIconFormat',
  'Monthly limit must be a non-negative finite number or null': 'errors.invalidMonthlyLimit',
  'Failed to update category': 'errors.failedToUpdateCategory',
  'Failed to delete category': 'errors.failedToDeleteCategory',
  'Name is required, non-empty, and must be at most 40 characters': 'errors.categoryNameLength',
  'Failed to create category': 'errors.failedToCreateCategory',
  'Forbidden': 'errors.forbidden',
  'Failed to export wallet data': 'errors.failedToExportWallet',
  'Forbidden: Insufficient permissions to import into this wallet': 'errors.insufficientImportPermissions',
  'Failed to import wallet data': 'errors.failedToImportWallet',
  'Failed to fetch invites': 'errors.failedToFetchInvites',
  'Unauthorized to create invites': 'errors.unauthorizedCreateInvites',
  'Failed to create invite': 'errors.failedToCreateInvite',
  'Failed to fetch wallet': 'errors.failedToFetchWallet',
  'Only the wallet owner can edit wallet settings': 'errors.onlyOwnerEditWallet',
  'Failed to update wallet': 'errors.failedToUpdateWallet',
  'Failed to fetch wallets': 'errors.failedToFetchWallets',
  'Wallet name is required': 'errors.walletNameRequired',
  'Failed to create wallet': 'errors.failedToCreateWallet',
  'Failed to fetch users': 'errors.failedToFetchUsers',
  'Name and email are required': 'errors.nameAndEmailRequired',
  'Failed to create user': 'errors.failedToCreateUser',
  'Invalid expense data': 'errors.invalidExpenseData',
  'Failed to add expense': 'errors.failedToAddExpense',
  'Viewers cannot edit expenses': 'errors.viewersCannotEditExpenses',
  'Viewers cannot create planned expenses': 'errors.viewersCannotCreatePlannedExpenses',
  'Title must be non-empty and at most 120 characters': 'errors.expenseTitleLength',
  'Amount must be a positive finite number': 'errors.positiveAmount',
  'Invalid date': 'errors.invalidDate',
  'Expected date is required': 'errors.expectedDateRequired',
  'Invalid expected date': 'errors.invalidExpectedDate',
  'Invalid category for this wallet': 'errors.invalidCategoryForWallet',
  'Failed to update expense': 'errors.failedToUpdateExpense',
  'Failed to create planned expense': 'errors.failedToCreatePlannedExpense',
  'Failed to delete expense': 'errors.failedToDeleteExpense',
};

export const STATUS_ERROR_MAP: Record<number, string> = {
  400: 'errors.badRequest',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  500: 'errors.serverError',
};

export function translateApiError(
  message: string | undefined,
  status: number | undefined,
  t: TranslationFunction
): string {
  if (message) {
    if (API_ERROR_MAP[message]) {
      return t(API_ERROR_MAP[message]);
    }
    if (message.startsWith('This invitation was sent specifically to')) {
      return t('errors.restrictedInvite');
    }
  }

  if (status && STATUS_ERROR_MAP[status]) {
    return t(STATUS_ERROR_MAP[status]);
  }

  return t.errors.generic;
}

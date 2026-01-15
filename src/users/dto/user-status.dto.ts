export class UserStatusDto {
  hasTenant: boolean;
  hasSchools: boolean;
  hasRoles: boolean;
  isOwner: boolean;
  emailVerified: boolean;
  hasCompletedProfile: boolean;
  status:
    | 'active'
    | 'pending'
    | 'blocked'
    | 'incomplete_profile'
    | 'email_unverified';
  message?: string;
}

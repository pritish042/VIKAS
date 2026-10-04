export function configuredEditor(user:{email:string;emailVerified:boolean},configuredEmails:string):boolean {
  return user.emailVerified&&configuredEmails.split(',').map(value=>value.trim().toLowerCase()).includes(user.email.toLowerCase());
}

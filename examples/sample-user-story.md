# User Story: Login with invalid credentials

**As a** registered user
**I want** to see a clear error message when I enter incorrect credentials
**So that** I understand I need to fix my email or password

## Acceptance criteria

- If the email does not exist, the message "No account exists with that email" is shown.
- If the email exists but the password is wrong, "Incorrect password" is shown.
- After 5 failed attempts, the login button is disabled for 60 seconds.
- The password field must never show the text in plain view (always type="password").

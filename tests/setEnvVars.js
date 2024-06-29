require('jest-extended/all')

//THESE ARE NOT ACTUAL SECRETS. THEY ARE DUMMY SECRETS FOR TESTING PURPOSES.
process.env.SECRET_FOR_TOKENS="specialtokensecret";
process.env.SECRET_FOR_REFRESH_TOKENS="specialrefreshtokensecret";
process.env.REFRESH_TOKEN_ENCRYPTION_KEY="specialrefreshtokenencryptionkey"
process.env.USE_JSON_MAIL_TRANSPORT="true"
process.env.SMTP_EMAIL = "nota@real.email"
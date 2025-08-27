// src/locales/en.ts
export const en = {
    welcome: (name: string, isAdmin: boolean) => 
      `Hello, ${name}! ��
  
  This is a service bot for balance management and admin panel.
  
  ${isAdmin ? '🔧 You have administrator rights' : '💰 Here you can manage your balance'}
  
  Use /help for command list.`,
  
    help: {
      title: '�� Available commands:\n\n',
      common: [
        '💰 /balance - Check balance',
        '�� /deposit - Deposit funds',
        '💸 /withdraw - Withdraw funds',
        '📊 /history - Transaction history'
      ],
      admin: [
        '🔧 /admin - Admin panel',
        '📈 /stats - Statistics',
        '👤 /user <id> - User information',
        '🚫 /ban <id> - Ban user',
        '✅ /unban <id> - Unban user'
      ]
    },
  
    errors: {
      tooManyRequests: '⚠️ Too many requests. Try again later.',
      userNotFound: '❌ User not found',
      insufficientBalance: '❌ Insufficient balance',
      invalidAmount: '❌ Invalid amount',
      serverError: '❌ Server error. Try again later.',
      accessDenied: '❌ Access denied',
      invalidCommand: '❌ Invalid command'
    },
  
    success: {
      balanceUpdated: '✅ Balance updated',
      userBanned: '✅ User banned',
      userUnbanned: '✅ User unbanned',
      transactionCreated: '✅ Transaction created'
    },
  
    admin: {
      panel: '🔧 Admin panel\n\nSelect action:',
      stats: '📈 Statistics',
      userInfo: '👤 User information',
      banUser: '🚫 Ban user',
      unbanUser: '✅ Unban user',

      loginPrompt: '🔐 Enter admin password:',
      loginSuccess: '✅ Authentication successful! Welcome to admin panel.',
      loginFailed: '❌ Wrong password. Try again.',
      passwordRequired: '🔐 Password required for admin panel access.',
      createPasswordPrompt: '🔐 Create new admin password (minimum 6 characters):',
      passwordCreated: '✅ Password created! You can now use /admin_login to enter.',
      passwordTooShort: '❌ Password must be at least 6 characters long.',
      alreadyAuthenticated: '✅ You are already authenticated as admin.',
      logoutSuccess: '✅ Logged out from admin panel.',
      notAuthenticated: '❌ You are not authenticated as admin. Use /admin_login'
    },
  
    balance: {
      current: (amount: number) => `💰 Your current balance: ${amount} USDT`,
      history: '📊 Transaction history:',
      noTransactions: '📊 No transactions found'
    },
  
    deposit: {
      title: '💳 Deposit funds',
      selectAmount: 'Select amount to deposit:',
      processing: '⏳ Processing payment...',
      address: (address: string) => `�� Deposit address:\n\`${address}\``
    },
  
    withdraw: {
      title: '💸 Withdraw funds',
      enterAmount: 'Enter amount to withdraw:',
      enterAddress: 'Enter wallet address:',
      processing: '⏳ Processing withdrawal...'
    }
  };
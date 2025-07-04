export const documentationContent = [
  {
    title: "What is XRP Staking?",
    paragraphs: [
      "XRP Staking is a process that allows XRP holders to lock their tokens for a specific period of time in exchange for rewards. Unlike traditional Proof of Stake mechanisms, XRP staking on our platform works through a custodial model where your XRP is held in secure escrow contracts on the XRP Ledger.",
      "When you stake your XRP, you're essentially contributing to the liquidity and stability of the ecosystem while earning Flare (FLR) tokens as rewards. The longer you stake your XRP, the higher the potential rewards you can earn."
    ]
  },
  {
    title: "How to Stake XRP",
    paragraphs: [
      "Staking XRP on our platform is a straightforward process designed to be accessible to both beginners and experienced users:"
    ],
    bulletPoints: [
      "Connect your XRP wallet (Only Xaman supported for now, later other wallets will be supported)",
      "Navigate to the 'Stake XRP' section",
      "Choose the amount of XRP you wish to stake",
      "Select a staking period (60, 120, or 240 days)",
      "Confirm the transaction in your wallet",
      "Your XRP is now staked and earning rewards!"
    ],
    note: "Make sure to keep your Flare wallet connected to claim rewards when they become available."
  },
  {
    title: "How Staking Works Behind the Scenes",
    paragraphs: [
      "Our staking mechanism is built on a sophisticated liquidity provision system that generates sustainable yields for all participants. Here's how it works:",
      "When you stake XRP, your tokens are added to an XRP/rLUSD automated market maker (AMM) pool on the XRP Ledger. This pool facilitates trading between XRP and rLUSD, generating trading fees from every swap transaction.",
      "These trading fees are collected and a significant portion (approximately 85%) is automatically converted to Flare (FLR) tokens. These FLR tokens constitute the rewards that are distributed to stakers proportionally based on their stake amount and duration.",
      "The longer your staking period, the higher your share of these rewards, which is why our 240-day staking option offers the highest APY. This incentivizes long-term participation and helps maintain liquidity stability in the pool."
    ],
    bulletPoints: [
      "Your staked XRP provides essential liquidity to the XRP/rLUSD trading pair",
      "Trading fees from the AMM pool are converted to FLR tokens",
      "Rewards are distributed proportionally based on stake amount and duration",
      "Early unstaking penalties are also converted to FLR and redistributed to loyal stakers"
    ],
    note: "This model creates a sustainable reward system where active market participation directly benefits all stakers."
  },
  {
    title: "Reward Structure",
    paragraphs: [
      "Rewards are calculated based on three key factors: the amount of XRP staked, the duration of the staking period, and the current APY rate. Our platform offers different APY rates depending on the lock period you choose.",
      "All rewards are distributed in Flare (FLR) tokens, which can be claimed through your connected Flare wallet once the staking period ends. The reward calculation is performed daily, allowing for compound interest effects over time."
    ],
    bulletPoints: [
      "60-day staking: Base APY rate",
      "120-day staking: Enhanced APY rate",
      "240-day staking: Premium APY rate"
    ]
  },
  {
    title: "Unstaking Process",
    paragraphs: [
      "You can unstake your XRP at any time, but please be aware that early unstaking (before your chosen lock period ends) may incur penalty fees. These fees are designed to maintain the stability of the staking ecosystem and protect the interests of long-term stakers.",
      "When you unstake early, a small percentage of your original stake is deducted as a penalty. This penalty is converted to Flare tokens and redistributed to the reward pool, benefiting users who maintain their stakes for the full duration. This mechanism discourages short-term speculation and rewards commitment to the platform.",
      "When you unstake after your lock period has ended, your full XRP amount is returned to your wallet without any penalties, and any earned rewards that haven't been claimed will be available in your Flare wallet."
    ],
    note: "The unstaking process typically takes 3 seconds to complete."
  },
  {
    title: "Platform Sustainability",
    paragraphs: [
      "Our platform operates on a sustainable business model where we retain a small portion (approximately 15%) of the generated trading fees to cover operational expenses, including server costs, security audits, development, and ongoing maintenance.",
      "This approach allows us to offer a reliable staking service without charging direct fees to our users. Instead, the platform is sustained by the natural activity of the XRP/rLUSD trading pair, aligning our incentives with those of our users – the more successful and active the platform, the more rewards for everyone involved."
    ]
  },
  {
    title: "Security Measures",
    paragraphs: [
      "Security is our top priority. All staked XRP is held in secure escrow contracts on the XRP Ledger, which are regularly audited by independent security firms. We implement industry-standard security practices, including multi-signature authorization, cold storage for the majority of assets, and regular security assessments.",
      "Our platform never takes custody of your private keys, ensuring that you maintain control over your assets at all times. All transactions require your explicit approval through your connected wallet."
    ]
  }
];

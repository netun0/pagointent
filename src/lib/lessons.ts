export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  paragraphs: string[];
};

export const lessons: Lesson[] = [
  {
    id: "key",
    title: "A wallet is a key",
    minutes: 2,
    paragraphs: [
      "A Sui address is not an account you apply for. It is a lock. The private key is the only thing that opens it, and Intenses created one the moment you accepted a payment.",
      "That key is encrypted with the password you chose, using AES-GCM, and the ciphertext stays in this browser. Intenses never receives the password or the key. If you forget the password, the coins are still on chain and nobody — not the payer, not us — can move them.",
    ],
  },
  {
    id: "usdc",
    title: "The dollars are USDC",
    minutes: 2,
    paragraphs: [
      "The intent was denominated in USDC, a token that tracks the US dollar. On Sui mainnet, native USDC is issued by Circle. This demo uses a test coin with the same 6 decimals so a hackathon wallet can hold real transactions without real money.",
      "The payer did not send coins straight to a stranger. They locked them in a shared object, an escrow anyone can see and only the claim secret can open. That object is the intent.",
    ],
  },
  {
    id: "accept",
    title: "What happened when you accepted",
    minutes: 3,
    paragraphs: [
      "The QR code carried a secret. The escrow hashed it with Blake2b-256 and compared it with the hash stored on chain. The match is what released the coins to your new address.",
      "You did not pay the network fee. A sponsor address paid the gas and added a little SUI so your next transaction can be yours to sign. That is how someone with no wallet can still receive crypto.",
    ],
  },
  {
    id: "gas",
    title: "Gas, without the folklore",
    minutes: 2,
    paragraphs: [
      "Every Sui transaction pays a fee in SUI. The fee is small, public, and goes to the validators who ordered the transaction. Your USDC balance and your SUI balance are different piles of coins.",
      "Sponsoring gas is a normal Sui pattern: one signature pays the fee, another address receives the asset. Intenses uses it so the first wallet in a person's life is not blocked by a coin they have never heard of.",
    ],
  },
  {
    id: "leave",
    title: "Take the key with you",
    minutes: 3,
    paragraphs: [
      "Intenses is a place to start, not a place that should hold your key forever. Download the encrypted backup. It is useless without your password, and useful on another browser if you import it.",
      "When you want a regular wallet, export the key into Slush, Sui's wallet app, and stop using the copy stored here. The production version of this idea ties the same address to a Google, Facebook, or Twitch login with Sui zkLogin, so there is no password file to lose. This demo uses a password so you can see the key, the ciphertext, and the chain side by side.",
    ],
  },
];

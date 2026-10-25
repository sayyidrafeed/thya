export const faqs = [
  {
    question: "What is Thya?",
    answer:
      "Thya is a business assistant you talk to in a chat. You ask about your shop in everyday Indonesian, and it answers with numbers from your sales records, what they mean, and one thing to try next.",
  },
  {
    question: "Can I use it on WhatsApp today?",
    answer:
      "Not yet. Thya is a prototype. Today it answers questions about a sample coffee shop, Kopi Senja. A WhatsApp number, recording sales by chat, and a daily recap are what we're building next.",
  },
  {
    question: "Where do the numbers come from?",
    answer:
      "From the shop's sales records. Thya works out every figure with fixed calculations, and the language model only puts it into words. When the data for a question isn't there, Thya says so instead of guessing.",
  },
  {
    question: "Does it work for my kind of business?",
    answer:
      "We started with food and drink: cafés, warung, and small restaurants, because their sales look alike (menu items, ingredients, daily takings). Retail and services come later.",
  },
  {
    question: "Where is my data processed?",
    answer:
      "The language model Thya uses runs on servers in Indonesia. The prototype only holds sample data, and we're still writing the full data policy.",
  },
  {
    question: "How much does it cost?",
    answer: "We haven't set pricing yet. The prototype is free to look at.",
  },
] as const;

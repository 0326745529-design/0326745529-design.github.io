# HAPPY TO EXAM — IaEmon

**বাংলা নির্দেশিকা**

---

## ⚡ চালানোর নিয়ম

1. জিপ ফাইলটি **Extract/Unzip** করুন
2. `text-to-handwriting-clean` ফোল্ডারের ভেতরে যান
3. **`index.html`-এ ডাবল-ক্লিক করুন** — ব্রাউজারে খুলবে ✅ (সার্ভার লাগবে না)
4. টেক্সট লিখুন → **Generate Image** → ইমেজ ডাউনলোড

চাইলে HTTP সার্ভার দিয়েও চালাতে পারেন:
```bash
python3 -m http.server 8000
```
তারপর: `http://localhost:8000`

---

## ✨ ফিচারসমূহ

| ফিচার | কোথায় | ব্যবহার |
|---|---|---|
| **Header Info** | Customizations → Header Info | নাম, ডিপার্টমেন্ট, ব্যাচ, রোল লিখুন — প্রতিটি পেজের উপরের মার্জিনে হাতের লেখায় দেখাবে। "First page only" বেছে নিলে শুধু প্রথম পেজে আসবে |
| **Effects (Trapezoid)** | Page & Text Options → Effects | Shadows / Scanner / No Effect / Trapezoid Light-Medium-Strong / Phone Photo / Phone Scan / Tilted / Random |
| **Phone Capture Options** | Effects-এর নিচে | Perspective Direction (এক/অন্য দিকে কাত) ও Background (Wooden desk সহ) বেছে নিন |
| **Page Colour** | Page & Text Options | ৭টি প্রিসেট + কাস্টম রঙ |
| **Scanner Watermark** | Scanner Watermark (Optional) | **CamScanner স্টাইল** — কালো CS আইকন (সবুজ বারসহ) + লেখা; **ডিফল্ট নিচে-ডানে**; লেখা ও Position বদলানো যায় |
| **Natural Margin** | Margin & Line Options | মার্জিন লাইন **কয়েক মিমি স্বাভাবিকভাবে দেবান করে** (আসল খাতার মতো) — উপরের আড়াআড়ি + বাম উল্লম্ব — দুটো লাইনই; প্রতিটি পেজে আলাদা দেবান |
| **Margin Line Colour** | Margin & Line Options | মার্জিন লাইনের রঙ পছন্দমতো বদলান (ডিফল্ট গোলাপি); Scanner এফেক্টে লাইনটি স্ক্যানের মতো গাঢ় হয় |
| **PDF এক্সপোর্ট** | Output-এর নিচে | ইমেজ জেনারেট করার পর **"Download All Images as PDF"** বাটনে ক্লিক করলে সব পেজ একসাথে PDF হয়ে ডাউনলোড হবে (অফলাইনেও কাজ করে) |

### 💡 টিপস
- হেডার দেখাতে হলে **Paper Margin টগল ON** থাকতে হবে
- Header Info-তে কোনো ঘর খালি রাখলে সেই জায়গা ফাঁকা থাকবে
- সব সেটিং ব্রাউজারে সেভ থাকে (localStorage) — পরে খুললেও আগের তথ্য পাবেন
- নিজের হাতের লেখার ফন্ট ব্যবহার করতে চাইলে Calligraphr.com-এ ফন্ট বানিয়ে .ttf আপলোড করুন

---

## 🧹 যা বাদ দেওয়া হয়েছে (আপনার অনুরোধে)

- ❌ "Guide to add your own handwriting" সেকশন
- ❌ "Sponsors" ও Buy me a Coffee বাটন
- ❌ "GitHub Contributors" তালিকা
- ❌ "FAQs" সেকশন
- ❌ নিচের লম্বা ধন্যবাদ/ফুটার টেক্সট
- ❌ Google Analytics ট্র্যাকিং
- ❌ GitHub কর্নার রিবন

অ্যাপের কাজের সাথে সম্পর্কহীন সবকিছু সরিয়ে শুধু টুলটি রাখা হয়েছে।

---

## 🛠 টেকনিক্যাল নোট

- `js/app.bundle.js` — সব মডিউলের একক বান্ডেল; **ডাবল-ক্লিক (file://) সাপোর্টের জন্য** এটাই লোড হয়
- সোর্স মডিউল `js/*.mjs`-এ আছে; ওগুলো বদলালে বান্ডেল রিবিল্ড করতে হবে
- jsPDF লোকালি যোগ করা — ইন্টারনেট ছাড়াও PDF ডাউনলোড কাজ করবে
- ইন্টারনেট না থাকলে শুধু Google Fonts লোড হবে না; বাকি সব অফলাইনে চলে

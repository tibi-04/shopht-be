const fetch = require("node-fetch");
const Chat = require("../../models/chatbot.models.js");
const Product = require("../../models/productModel.js");

function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const CATEGORIES = [
  "tai nghe",
  "đồng hồ",
  "điện thoại",
  "màn hình",
  "laptop",
  "loa",
  "chuột",
  "bàn phím",
  "máy in",
  "camera",
  "tivi",
  "phụ kiện",
];

function detectCategory(question) {
  const q = question.toLowerCase();
  for (const cat of CATEGORIES) {
    if (q.includes(cat)) {
      return cat;
    }
  }
  return null;
}

exports.chatbotHandler = async (req, res) => {
  const { question } = req.body;

  if (
    !question ||
    typeof question !== "string" ||
    question.trim().length === 0
  ) {
    return res.status(400).json({
      error: "Question is required and must be a non-empty string.",
    });
  }

  try {
    const detectedCat = detectCategory(question);


    if (!detectedCat) {
      const quickPrompt = `
Bạn là trợ lý thân thiện của HTShop.
Trả lời thật ngắn gọn (tối đa 1-2 câu) và tự nhiên câu hỏi: "${question}".
Không cần liệt kê sản phẩm. Hãy trả lời như một nhân viên cửa hàng công nghệ.
      `;

      const quickRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat-v3.1:free",
            max_tokens: 80,
            temperature: 0.7,
            messages: [
              { role: "system", content: "Bạn là trợ lý AI của HTShop." },
              { role: "user", content: quickPrompt },
            ],
          }),
        }
      );

      if (!quickRes.ok) {
        const errorText = await quickRes.text();
        console.error("Lỗi từ OpenRouter:", errorText);
        return res.status(quickRes.status).json({ error: errorText });
      }

      const quickData = await quickRes.json();
      const answer =
        quickData.choices?.[0]?.message?.content ||
        "HTShop chưa nhận được phản hồi từ AI.";

      await new Chat({ question, answer }).save();
      return res.json({ answer, suggestedProducts: [], products: [] });
    }


    const products = await Product.find({
      category: { $regex: detectedCat, $options: "i" },
    })
      .limit(3)
      .lean();

    if (products.length === 0) {
      return res.json({
        answer: `Xin lỗi, hiện tại HTShop chưa tìm thấy sản phẩm thuộc danh mục "${detectedCat}".`,
        suggestedProducts: [],
        products: [],
      });
    }

    const productData = products.map((p) => ({
      _id: p._id,
      name: p.productName,
      brand: p.brandName,
      category: p.category,
      price: p.sellingPrice,
      description: p.description,
      more_details: p.more_details,
      productImage: p.productImage,
    }));

    const productPrompt = `
Bạn là trợ lý bán hàng thân thiện của HTShop.
Danh sách sản phẩm (tối đa 3):
${JSON.stringify(productData)}

Trả lời:
- Gọi khách là "bạn", xưng HTShop.
- Viết tối đa 2 câu, tự nhiên và dễ hiểu.
- Chỉ dùng đúng tên sản phẩm trong danh sách trên, không bịa.
- Có thể khuyến khích khách xem chi tiết hoặc liên hệ HTShop.
Câu hỏi của khách: "${question}"
    `;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3.1:free",
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            { role: "system", content: "Bạn là trợ lý AI của HTShop." },
            { role: "user", content: productPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lỗi từ OpenRouter:", errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const answer =
      data.choices?.[0]?.message?.content ||
      "HTShop chưa nhận được phản hồi từ AI.";

    const normalizedAnswer = normalizeString(answer);
    const suggestedProducts = productData.filter((p) =>
      normalizedAnswer.includes(normalizeString(p.name))
    );

    await new Chat({ question, answer }).save();
    res.json({
      answer,
      suggestedProducts,
      products: productData,
    });
  } catch (error) {
    console.error("Lỗi chatbotHandler:", error);
    res.status(500).json({ error: "Lỗi khi gọi chatbot." });
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    topic, tone, length, purpose,
    reader_level, risk_level,
    industry, company_size, area, position
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'テーマを入力してください' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const prompt = `あなたは商用利用前提のコラム文章を作成するAIです。
以下の制約を必ず守ってください。

【厳守事項】
・個別の助言や結論は禁止
・断定表現は禁止（「〜すべき」「〜必要」「必ず」などは使わない）
・脱法・裏技表現は禁止
・他者否定は禁止
・不安を過度に煽らない
・数値・税率・具体的期限は記載しない

【立場】
あなたは中立的な解説者です。答えを出さず、読者が自分で考えるための材料を整理してください。

【文章条件】
・トーン：${tone}
・想定読者：${reader_level}
・目的：${purpose}
・リスク許容度：${risk_level}

【クライアント情報】
業種：${industry || '未指定'}
規模：${company_size || '未指定'}
地域：${area || '未指定'}
立場：${position || '未指定'}

【出力条件】
・文字数：${length}文字前後
・見出しは【見出し】形式で記載（markdownのハッシュ記号は使わない）
・HTML装飾なし、プレーンテキストで出力
・最後に「詳しくは専門家へのご相談をおすすめします」という趣旨の一文を入れる

【テーマ】
${topic}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('生成結果が空です');

    const NG_WORDS = ['すべき', '必要があります', '必ず', '必須', '絶対に'];
    const ngHits = NG_WORDS.filter(w => text.includes(w));

    return res.status(200).json({ text, ngHits });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'APIエラーが発生しました: ' + err.message });
  }
};

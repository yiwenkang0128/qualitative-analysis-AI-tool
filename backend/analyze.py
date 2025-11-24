import sys
import json
import os
import re

# 禁用并行以防死锁
os.environ["TOKENIZERS_PARALLELISM"] = "false"

try:
    from dotenv import load_dotenv
    from openai import OpenAI
    import pdfplumber
    from bertopic import BERTopic
    from sklearn.feature_extraction.text import CountVectorizer
except Exception as e:
    print(json.dumps({"error": f"库导入失败: {str(e)}"}))
    sys.exit(1)

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if len(sys.argv) < 2:
    print(json.dumps({"error": "缺少 PDF 文件路径"}))
    sys.exit(1)

pdf_path = sys.argv[1]
base_filename = os.path.basename(pdf_path)

# 1. 文本提取
def extract_text_from_pdf(path):
    text_list = []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    lines = text.split("\n")
                    for line in lines:
                        line = line.strip()
                        if re.search(r'Page \d+ of \d+', line): continue
                        if len(line) < 10: continue 
                        text_list.append(line)
    except Exception as e:
        return []
    return text_list

texts = extract_text_from_pdf(pdf_path)

if not texts or len(texts) < 5:
    print(json.dumps({"error": "PDF 内容太少，无法分析"}))
    sys.exit(1)

# 截取全文 (10万字左右，存入数据库用)
full_doc_text = "\n".join(texts)[:100000]

try:
    client = OpenAI(api_key=api_key)

    # 2. 运行 BERTopic
    vectorizer_model = CountVectorizer(stop_words="english", ngram_range=(1, 2))
    topic_model = BERTopic(
        vectorizer_model=vectorizer_model,
        language="english", 
        calculate_probabilities=False,
        nr_topics=6 
    )
    
    topics, probs = topic_model.fit_transform(texts)
    topic_info = topic_model.get_topic_info()
    top_topics = topic_info[topic_info['Topic'] != -1].head(5)
    
    topic_structure_data = "【算法提取的主题线索】:\n"
    for index, row in top_topics.iterrows():
        topic_structure_data += f"- {row['Name']}\n"

    # 3. 生成综述
    prompt = f"""
    你是一个文档助手。请根据下方信息生成 JSON。
    
    1. "summary": 100-200字文档综述，语气亲切。
    2. "topics": 3-5个核心主题数组 (emoji, title, description)。

    {topic_structure_data}
    【文档全文片段】:
    {full_doc_text[:5000]}... (后略)
    """

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    ai_response = completion.choices[0].message.content
    result = json.loads(ai_response)
    
    # 🌟 核心变化：不再保存文件，而是将全文和文件名返回给 Node.js
    # Node.js 会负责把这些数据存入 PostgreSQL
    result['serverFilename'] = base_filename
    result['fullText'] = full_doc_text 
    
    print(json.dumps(result, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
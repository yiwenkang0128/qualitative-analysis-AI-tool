import sys
import json
import os
import re

os.environ["TOKENIZERS_PARALLELISM"] = "false"

try:
    from dotenv import load_dotenv
    from openai import OpenAI
    import pdfplumber
    from bertopic import BERTopic
    from sklearn.feature_extraction.text import CountVectorizer
except Exception as e:
    print(json.dumps({"error": f"Library import failed: {str(e)}"}))
    sys.exit(1)

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if len(sys.argv) < 2:
    print(json.dumps({"error": "Missing PDF file path"}))
    sys.exit(1)

pdf_path = sys.argv[1]
base_filename = os.path.basename(pdf_path)

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
    print(json.dumps({"error": "PDF content too short or unreadable"}))
    sys.exit(1)

full_doc_text = "\n".join(texts)[:120000]

try:
    client = OpenAI(api_key=api_key)

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
    
    topic_structure_data = "Topic Clues:\n"
    for index, row in top_topics.iterrows():
        topic_structure_data += f"- {row['Name']}\n"

    prompt = f"""
    You are a document assistant. Please generate a JSON object based on the information below.
    
    1. "summary": 100-200 words document summary, professional and friendly tone.
    2. "topics": An array of 3-5 core topics (keys: "emoji", "title", "description").

    {topic_structure_data}
    [Document Snippet]:
    {full_doc_text[:5000]}...
    """

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    ai_response = completion.choices[0].message.content
    
    result = json.loads(ai_response)
    result['serverFilename'] = base_filename
    result['fullText'] = full_doc_text 
    
    print(json.dumps(result, ensure_ascii=False))

except Exception as e:
    import traceback
    traceback.print_exc(file=sys.stderr)
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
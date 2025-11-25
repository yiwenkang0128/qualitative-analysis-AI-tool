import sys
import json
import os
import traceback

sys.stdout.reconfigure(encoding='utf-8')

try:
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    
    from dotenv import load_dotenv
    from openai import OpenAI

    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")

    if len(sys.argv) < 3:
        print(json.dumps({"answer": "System error: Missing parameters (filename or query)"}))
        sys.exit(0)

    filename = sys.argv[1]
    user_query = sys.argv[2]

    current_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(current_dir, "processed_cache")
    cache_path = os.path.join(cache_dir, f"{filename}.json")

    if not os.path.exists(cache_path):
        print(json.dumps({"answer": "Cache file not found. Please re-upload the document."}))
        sys.exit(0)

    with open(cache_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        full_text = data.get("full_text", "")

    if not full_text:
        print(json.dumps({"answer": "Cache file corrupted or empty."}))
        sys.exit(0)

    client = OpenAI(api_key=api_key)

    prompt = f"""
    You are a professional document assistant. You have access to the full text of the document.
    Please answer the user's question based on the document content. Cite specific data or viewpoints from the text.
    
    [User Question]: {user_query}
    
    [Document Full Text (Truncated)]:
    {full_text}
    """

    completion = client.chat.completions.create(
        model="gpt-4o", 
        messages=[{"role": "user", "content": prompt}]
    )
    
    answer = completion.choices[0].message.content
    
    print(json.dumps({"answer": answer}, ensure_ascii=False))

except Exception as e:
    sys.stderr.write(f"Python script error:\n{traceback.format_exc()}\n")
    error_response = {
        "answer": f"Sorry, an error occurred while processing: {str(e)}"
    }
    print(json.dumps(error_response, ensure_ascii=False))
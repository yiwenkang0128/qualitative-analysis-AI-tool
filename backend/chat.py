import sys
import json
import os
import traceback

# 1. 强制设置标准输出编码，防止中文乱码
sys.stdout.reconfigure(encoding='utf-8')

# 2. 错误处理包装器：确保无论发生什么，最后都输出 JSON
try:
    # 禁用并行警告
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    
    from dotenv import load_dotenv
    from openai import OpenAI

    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")

    if len(sys.argv) < 3:
        print(json.dumps({"answer": "系统错误：缺少参数 (文件名或问题)"}))
        sys.exit(0)

    # 接收参数
    filename = sys.argv[1]
    user_query = sys.argv[2]

    # 3. 路径检查
    # 确保路径拼接正确，且兼容不同操作系统
    current_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(current_dir, "processed_cache")
    cache_path = os.path.join(cache_dir, f"{filename}.json")

    if not os.path.exists(cache_path):
        # 调试信息：把路径打印出来方便排查
        error_msg = f"找不到缓存文件。请尝试重新上传文档。\n(寻找路径: {cache_path})"
        print(json.dumps({"answer": error_msg}))
        sys.exit(0)

    # 4. 读取文件
    with open(cache_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        full_text = data.get("full_text", "")

    if not full_text:
        print(json.dumps({"answer": "缓存文件损坏或内容为空。"}))
        sys.exit(0)

    # 5. 调用 OpenAI
    client = OpenAI(api_key=api_key)

    prompt = f"""
    你是一个专业的文档助手。你拥有文档的全文。
    请基于文档内容回答用户问题。引用文档中的具体数据或观点。
    
    【用户问题】: {user_query}
    
    【文档全文 (前12万字符)】:
    {full_text}
    """

    completion = client.chat.completions.create(
        model="gpt-4o", 
        messages=[{"role": "user", "content": prompt}]
    )
    
    answer = completion.choices[0].message.content
    
    # 6. 成功输出
    print(json.dumps({"answer": answer}, ensure_ascii=False))

except Exception as e:
    # 捕获所有未知错误，并打印到 stderr 供调试，同时返回友好的 JSON 给前端
    # 将详细错误打印到后端控制台，方便你查看
    sys.stderr.write(f"Python 脚本执行出错:\n{traceback.format_exc()}\n")
    
    # 返回给前端的错误提示
    error_response = {
        "answer": f"抱歉，AI 思考时遇到错误: {str(e)}"
    }
    print(json.dumps(error_response, ensure_ascii=False))
import base64
import os
import mimetypes
from google import genai
from google.genai import types
import datetime

def save_binary_file(file_name, data):
    f = open(file_name, "wb")
    f.write(data)
    f.close()


def generate(userinput):
    client = genai.Client(
        api_key="",
    )

    model = "gemini-2.0-flash-exp-image-generation"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=f"Use the following depictions to generate the most suitable image:\"{userinput}\""),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_modalities=[
            "image",
            "text",
        ],
        safety_settings=[
            types.SafetySetting(
                category="HARM_CATEGORY_HARASSMENT",
                threshold="BLOCK_LOW_AND_ABOVE",  # Block most
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_HATE_SPEECH",
                threshold="BLOCK_LOW_AND_ABOVE",  # Block most
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold="BLOCK_LOW_AND_ABOVE",  # Block most
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold="BLOCK_LOW_AND_ABOVE",  # Block most
            ),
        ],
        response_mime_type="text/plain",
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )
    if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            # print(part)
            if part.inline_data:
                now = datetime.datetime.now() + datetime.timedelta(hours=8)
                file_name = f"output/{now.strftime('%m%d%H%M%S')}"
                inline_data = part.inline_data
                file_extension = mimetypes.guess_extension(inline_data.mime_type)
                save_binary_file(f"{file_name}{file_extension}", inline_data.data)
                print(f"File of mime type {inline_data.mime_type} saved to: {file_name}")
                return f"{file_name}{file_extension}"
            else:
                # print(response.text)
                pass
    else:
        print("No response content received.")
        return None


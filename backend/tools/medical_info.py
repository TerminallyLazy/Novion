import requests
from bs4 import BeautifulSoup
from langchain.tools import tool

@tool("Search_wikem_for_condition")
def search_wikem(query: str) -> str:
    """Search WikEM for a given condition to understand management options (this includes medications and treatments)."""
    base_url = 'https://wikem.org'
    search_url = f'{base_url}/w/index.php?search={query}'

    print("The following is the search query: ", query)

    response = requests.get(search_url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        marker_text = "Contents"
        marker = soup.find(string=marker_text)
        
        start_point = marker.find_parent('div') if marker else None

        result = ""
        if start_point:
            for tag in start_point.find_all_next(['h1', 'h2', 'h3', 'ul', 'p']):
                if tag.name in ['h1', 'h2', 'h3']:
                    result += f"{tag.get_text()}\n"
                elif tag.name == 'ul':
                    list_items = tag.find_all('li', recursive=False)
                    for li in list_items:
                        result += f"- {li.get_text()}\n"
                        sub_lists = li.find_all('ul')
                        for sub_list in sub_lists:
                            sub_items = sub_list.find_all('li', recursive=False)
                            for sub_item in sub_items:
                                result += f"  - {sub_item.get_text()}\n"
                elif tag.name == 'p':
                    result += f"{tag.get_text()}\n"
        else:
            result = "The specific marker was not found in the page content."

        return result.strip()
    else:
        return "Failed to retrieve the webpage"


result = search_wikem("hypokalemia")
print(result)

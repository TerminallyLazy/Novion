import requests
from bs4 import BeautifulSoup
from pprint import pprint
from langchain.tools import tool
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

class Methods(BaseModel):
    method: str
    description: str

class ResearchPaper(BaseModel):
    title: str = Field(..., description="Title of the research paper")
    authors: list[str] = Field(..., description="Authors of the research paper")
    abstract: str = Field(..., description="Abstract of the research paper")
    introduction: str = Field(..., description="Introduction of the research paper")
    methods: list[Methods] = Field(..., description="A list of the methods used in the research paper")
    results: str = Field(..., description="Results of the research paper")
    discussion: str = Field(..., description="Discussion of the research paper")
    paper_url: str = Field(..., description="URL of the research paper")

def search_pubmed(query, retmax=10):
    """
    Description: Search PubMed for the given query and return a list of PMIDs.
    -Input: Query (str)
    -Output: PMIDs (list)
    """
    esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": retmax,
        "retmode": "json"
    }
    response = requests.get(esearch_url, params=params)
    response.raise_for_status()  # Raise an error for bad responses
    data = response.json()
    return data["esearchresult"]["idlist"]

def fetch_pubmed_details(query, retmax=10):
    """
    Description: Retrieve details for a list of PMIDs using the ESummary endpoint.
    """
    pmids = search_pubmed(query, retmax)
    if not pmids:
        return {"result": {"uids": []}}

    esummary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "json"
    }
    response = requests.get(esummary_url, params=params)
    response.raise_for_status()
    summary_data = response.json()

    efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml"
    }
    response = requests.get(efetch_url, params=params)
    response.raise_for_status()
    fetch_data = BeautifulSoup(response.text, 'xml')

    for pmid in pmids:
        abstract = fetch_data.find('AbstractText', {'Label': pmid})
        if abstract:
            summary_data["result"][pmid]["abstract"] = abstract.get_text(strip=True)
        else:
            summary_data["result"][pmid]["abstract"] = "No abstract available"

    return summary_data

def get_pubmed_identifiers(url):
    """
     Description: Returns pubmed identifier
    - Input: url (str)
    - Output: Identifiers (list)
    """
    response = requests.get(url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        identifiers = {}

        # PMID
        pmid_tag = soup.select_one(
            "ul#full-view-identifiers li span.identifier.pubmed strong.current-id")
        if (pmid_tag):
            identifiers['PMID'] = pmid_tag.get_text(strip=True)
        else:
            identifiers['PMID'] = None

        # PMCID
        pmcid_tag = soup.select_one(
            "ul#full-view-identifiers li span.identifier.pmc a.id-link")
        if (pmcid_tag):
            identifiers['PMCID'] = pmcid_tag.get_text(strip=True)
        else:
            identifiers['PMCID'] = None

        # DOI
        doi_tag = soup.select_one(
            "ul#full-view-identifiers li span.identifier.doi a.id-link")
        if (doi_tag):
            identifiers['DOI'] = doi_tag.get("href")
        else:
            identifiers['DOI'] = None

        return identifiers
    else:
        raise Exception(
            f"Error retrieving the page: HTTP {response.status_code}")


def get_pmc_link(url):
    """
    Description: Returns the pmc link
    """
    identifiers = get_pubmed_identifiers(url)
    pmcid = identifiers.get('PMCID')
    if pmcid:
        pmc_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/"
        return pmc_url
    else:
        return None

def retrieve_article_text(pmc_url):
    """
    Description: retrieves article text
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
    response = requests.get(pmc_url, headers=headers)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract the first h1 tag which is always the title
        title_tag = soup.find('h1')
        title_text = title_tag.get_text(strip=True) if title_tag else "No title available"
        
        h2_tags = soup.find_all(['h2', 'h3'])
        h2_h3_p_texts = []
        exclude_texts = ["Supplementary material", "Acknowledgments",
                         "Associated Data", "Competing interests", "CRediT author statement"]
        for tag in h2_tags:
            tag_text = tag.get_text(strip=True)
            if any(exclude_text in tag_text for exclude_text in exclude_texts):
                continue
            p_tags = []
            for sibling in tag.find_next_siblings():
                if sibling.name in ['h2', 'h3']:
                    break
                if sibling.name == 'p':
                    p_tags.append(sibling.get_text(strip=True))
            if p_tags:
                h2_h3_p_texts.append(
                    {'tag': tag.name, 'text': tag_text, 'p_tags': p_tags})
        
        return {"title": title_text, "sections": h2_h3_p_texts}
    else:
        raise Exception(
            f"Error retrieving the page: HTTP {response.status_code}")

model = ChatOpenAI(model="gpt-4o-mini", temperature=0)
structured_llm = model.with_structured_output(ResearchPaper)

@tool("Retrieve_research_papers_from_PubMed_based_on_query")
def research_retriever(query):
    """
    Description: Retrieve research papers from PubMed based on the given query. The function returns every paper's
    title, authors, abstract, introduction, methods, results, discussion, and the URL of the paper.

    - Input: Query (str)
    - Output: List of research papers (list)
    """
    print(f"Got query: {query}")
    paper_ids = search_pubmed(query)
    print(f"Found paper IDs: {paper_ids}")
    papers = []
    for paper_id in paper_ids:
        url = f"https://pubmed.ncbi.nlm.nih.gov/{paper_id}/"
        print(f"Processing paper ID: {paper_id} with URL: {url}")
        pmc_link = get_pmc_link(url)
        if pmc_link:
            print(f"Found PMC link: {pmc_link}")
            article_text = retrieve_article_text(pmc_link)
            print(f"Retrieved article text for PMC link: {pmc_link}")
            papers.append({"paper_id": paper_id, "pmc_link": pmc_link, "article_text": article_text})
            for paper in papers:
                print(f"Invoking structured LLM for paper ID: {paper['paper_id']}")
                response = structured_llm.invoke(str(paper))
    print("Completed processing all papers.")
    return response


#if __name__ == "__main__":
    # Example usage of search_pubmed
    # query = "cancer"
   
    # Example usage of retrieve_article_text
    # papers = research_retriever(query)
    # print(papers)
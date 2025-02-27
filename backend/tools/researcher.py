import requests
from bs4 import BeautifulSoup
from pprint import pprint


def search_pubmed(query, retmax=10):
    """
    Search PubMed for the given query and return a list of PMIDs.
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
    Retrieve details for a list of PMIDs using the ESummary endpoint.
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
    identifiers = get_pubmed_identifiers(url)
    pmcid = identifiers.get('PMCID')
    if pmcid:
        pmc_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/"
        return pmc_url
    else:
        return None


def retrieve_article_text(pmc_url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
    response = requests.get(pmc_url, headers=headers)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
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
        return h2_h3_p_texts
    else:
        raise Exception(
            f"Error retrieving the page: HTTP {response.status_code}")


url = "https://pubmed.ncbi.nlm.nih.gov/36462630/"
pmc_link = get_pmc_link(url)
if pmc_link:
    h2_h3_p_texts = retrieve_article_text(pmc_link)
    pprint(h2_h3_p_texts)
else:
    print("PMCID not found")


# Example query to search PubMed
query = "COVID-19"

# Search PubMed and fetch details
pubmed_details = fetch_pubmed_details(query, retmax=5)
pprint(pubmed_details)

# Example PubMed article URL
url = "https://pubmed.ncbi.nlm.nih.gov/36462630/"

# Get PMC link from PubMed URL
pmc_link = get_pmc_link(url)
print(f"PMC Link: {pmc_link}")

# Retrieve article text from PMC link
if pmc_link:
    article_text = retrieve_article_text(pmc_link)
    pprint(article_text)
else:
    print("PMCID not found")

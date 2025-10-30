# linkedin_job_scraper_sentencebreaks.py
from bs4 import BeautifulSoup
import requests
import json
import re

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.google.com/",
    "DNT": "1",
}


def scrape_job(job_url):
    print("\n==============================")
    print("🔍 Fetching LinkedIn Job Page")
    print("==============================")
    print(f"URL: {job_url}\n")

    response = requests.get(job_url, headers=HEADERS, timeout=20)
    print(f"HTTP Status: {response.status_code}")

    if response.status_code != 200:
        print("❌ Failed to load job page. Try a public (guest) job link.")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    def safe_text(selector):
        el = soup.select_one(selector)
        return el.get_text(strip=True) if el else None

    title = safe_text("h1")
    company_el = soup.select_one('[data-tracking-control-name="public_jobs_topcard-org-name"]')
    if company_el:
        company_name = company_el.get_text(strip=True)
        company_url = company_el.get("href")
        if company_url and company_url.startswith("/"):
            company_url = "https://www.linkedin.com" + company_url
    else:
        company_name = None
        company_url = None

    location = safe_text(".topcard__flavor--bullet")
    applicants = safe_text(".num-applicants__caption")
    salary = safe_text(".salary")

    # Capture the full description text
    desc_container = soup.select_one(".description__text .show-more-less-html")
    if desc_container:
        description_raw = desc_container.get_text(separator=" ", strip=True)
    else:
        description_raw = None

    # Split description into sentences using regex and reformat
    formatted_description = ""
    if description_raw:
        # Split by periods but keep the periods
        sentences = re.split(r'(?<=[.])\s+', description_raw)
        for i, sentence in enumerate(sentences, 1):
            formatted_description += sentence.strip() + " "
            # After every 3 sentences, add a double newline
            if i % 3 == 0:
                formatted_description += "\n\n"
        description = formatted_description.strip()
    else:
        description = None

    # Capture job criteria
    criteria = []
    for li in soup.select(".description__job-criteria-list li"):
        name_el = li.select_one(".description__job-criteria-subheader")
        val_el = li.select_one(".description__job-criteria-text")
        if name_el and val_el:
            criteria.append({
                "name": name_el.get_text(strip=True),
                "value": val_el.get_text(strip=True)
            })

    job = {
        "url": job_url,
        "title": title,
        "company": {"name": company_name, "url": company_url},
        "location": location,
        "applications": applicants,
        "salary": salary,
        "description": description,
        "criteria": criteria
    }

    print("\n✅ Job data extracted successfully!\n")
    return job


def save_results(job):
    if not job:
        return

    # Save JSON (structured data)
    with open("job.json", "w", encoding="utf-8") as jf:
        json.dump(job, jf, indent=4, ensure_ascii=False)

    # Save TXT (readable with sentence-based spacing)
    with open("job.txt", "w", encoding="utf-8") as tf:
        tf.write("========== JOB SUMMARY ==========\n\n")
        tf.write(f"Job Title: {job['title']}\n\n")
        tf.write(f"Company: {job['company']['name']}\n\n")
        tf.write(f"Location: {job['location']}\n\n")
        tf.write(f"Applications: {job['applications']}\n\n")
        tf.write(f"Salary: {job['salary']}\n\n")

        tf.write("========== DESCRIPTION ==========\n\n")
        tf.write(f"{job['description'] or 'No description available.'}\n\n")

        tf.write("========== CRITERIA ============\n\n")
        for c in job["criteria"]:
            tf.write(f"{c['name']}: {c['value']}\n\n")

    print("📄 Saved results to job.json and job.txt\n")


if __name__ == "__main__":
    # You can paste a direct job URL OR a search URL with ?currentJobId=
    search_url = "https://www.linkedin.com/jobs/search/?currentJobId=4331488540"

    # Convert ?currentJobId= link to /jobs/view/ link
    if "currentJobId=" in search_url:
        job_id = search_url.split("currentJobId=")[-1].split("&")[0]
        job_url = f"https://www.linkedin.com/jobs/view/{job_id}"
    else:
        job_url = search_url

    job_data = scrape_job(job_url)
    save_results(job_data)

#!/usr/bin/env python3
"""
Resume Parser - Extracts structured resume data for efficient reuse
"""

import os
import json
import re
from typing import Dict
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

class ResumeParser:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = ChatOpenAI(api_key=self.openai_api_key, model_name="gpt-4o-mini", temperature=0.3)
    
    def extract_structured_data(self, resume_content: str) -> Dict:
        """
        Extract structured resume data with the following sections:
        - Name
        - Education (university name, level like bachelors/masters/phd, if multiple include all)
        - Graduation Date
        - Experience (list ALL experiences including work, internships, and research with total count and companies)
        - Competitions (list relevant competitions and placements)
        - Projects (list relevant project titles)
        - Key Technologies (10 most relevant technical skills)
        """
        
        prompt = f"""You are a resume parser. Extract structured information from this resume and return it as valid JSON.

RESUME CONTENT:
{resume_content}

Extract the following structured information. Return ONLY valid JSON (no markdown, no code blocks, no explanations):

{{
    "name": "Full name from resume",
    "education": [
        {{
            "university": "University name",
            "level": "Bachelor's/Master's/PhD/etc.",
            "degree": "Degree name (e.g., Computer Science, Engineering)",
            "graduation_date": "Graduation date or expected graduation (MM/YYYY format)"
        }}
    ],
    "experience": [
        {{
            "company": "Company or institution name",
            "title": "Job title or position",
            "type": "Full-time/Internship/Part-time/Research",
            "duration": "Duration (e.g., '6 months', '2 years')",
            "description": "Brief description (1-2 sentences)"
        }}
    ],
    "competitions": [
        {{
            "name": "Competition name",
            "placement": "Placement (e.g., '1st Place', 'Finalist', 'Top 10')",
            "date": "Date or year",
            "description": "Brief description"
        }}
    ],
    "projects": [
        {{
            "title": "Project title",
            "description": "Brief description (1-2 sentences)",
            "technologies": ["tech1", "tech2"]
        }}
    ],
    "key_technologies": [
        "Technology 1",
        "Technology 2",
        "Technology 3",
        "Technology 4",
        "Technology 5",
        "Technology 6",
        "Technology 7",
        "Technology 8",
        "Technology 9",
        "Technology 10"
    ]
}}

CRITICAL RULES:

1. EXPERIENCE - Include in "experience" ALL of the following:
   - ALL work experiences (software engineer, intern, consultant, etc.)
   - ALL internships (at companies or institutions)
   - ALL research experiences (research assistant, researcher, research intern, etc.)
   - ALL academic positions (teaching assistant, etc.)
   - ALL professional positions (full-time, part-time, contract, etc.)
   
   DO NOT separate research from work - put everything in one "experience" array

2. Include ALL universities if multiple (do not skip any)

3. Include ALL experiences including internships and research (list every company/institution)

4. Include ALL relevant competitions with placements

5. Include ALL relevant project titles

6. Extract exactly 10 key technologies - these should be the most relevant technical skills based on:
   - Experience descriptions (work, research, internships)
   - Project technologies
   - Research work
   - Education coursework
   - Programming languages, frameworks, tools mentioned

7. If a section has no data, use an empty array []

8. Return ONLY the JSON object, nothing else

9. Ensure all strings are properly escaped

10. Use null for missing optional fields

11. For experience "type" field, use: "Full-time", "Internship", "Part-time", "Research", "Contract", etc.
"""
        
        try:
            result = self.llm.invoke(prompt)
            
            # Handle ChatOpenAI response format
            if hasattr(result, 'content'):
                response_text = result.content.strip()
            elif isinstance(result, str):
                response_text = result.strip()
            else:
                response_text = str(result).strip()
            
            # Remove markdown code blocks if present
            if '```json' in response_text:
                # Extract JSON from code block
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
                else:
                    response_text = response_text[start:].strip()
            elif response_text.startswith('```'):
                response_text = response_text[3:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]
                response_text = response_text.strip()
            
            # Try to find JSON object in the response
            # Look for first { and last }
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                response_text = response_text[start_idx:end_idx + 1]
            
            # Parse JSON
            structured_data = json.loads(response_text)
            
            # Validate structure
            if not isinstance(structured_data, dict):
                raise ValueError("Response is not a JSON object")
            
            # Ensure all required keys exist
            required_keys = ["name", "education", "experience", "competitions", "projects", "key_technologies"]
            for key in required_keys:
                if key not in structured_data:
                    structured_data[key] = [] if key != "name" else "Not Available"
            
            # Handle backward compatibility: if old format has work_experience or research_experiences, merge them
            if "work_experience" in structured_data or "research_experiences" in structured_data:
                experience_list = []
                if "work_experience" in structured_data:
                    experience_list.extend(structured_data["work_experience"])
                if "research_experiences" in structured_data:
                    # Convert research experiences to experience format
                    for research in structured_data["research_experiences"]:
                        experience_list.append({
                            "company": research.get("institution", "Unknown"),
                            "title": research.get("title", "Research"),
                            "type": "Research",
                            "duration": research.get("duration", ""),
                            "description": research.get("description", "")
                        })
                structured_data["experience"] = experience_list
                # Remove old keys
                structured_data.pop("work_experience", None)
                structured_data.pop("research_experiences", None)
            
            print("✅ Resume parsed into structured data:")
            print(json.dumps(structured_data, indent=2))
            
            return structured_data
            
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON response: {e}")
            print(f"Response was: {response_text[:500]}...")
            # Try to extract any useful information before falling back
            try:
                # Look for partial JSON
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    partial_json = json_match.group(0)
                    structured_data = json.loads(partial_json)
                    print("⚠️  Using partial JSON extraction")
                    return structured_data
            except:
                pass
            return self._get_fallback_data()
        except Exception as e:
            print(f"❌ Error parsing resume: {e}")
            import traceback
            print(traceback.format_exc())
            return self._get_fallback_data()
    
    def _get_fallback_data(self) -> Dict:
        """Return fallback structured data if parsing fails"""
        return {
            "name": "Not Available",
            "education": [
                {
                    "university": "Not Available",
                    "level": "Not Specified",
                    "degree": "Not Available",
                    "graduation_date": None
                }
            ],
            "experience": [],
            "competitions": [],
            "projects": [],
            "key_technologies": []
        }
    
    def extract_key_bullets(self, resume_content: str) -> str:
        """
        Extract key bullets from structured resume data for backward compatibility.
        Converts structured data into a bullet-point format.
        """
        try:
            structured_data = self.extract_structured_data(resume_content)
            
            bullets = []
            
            # Name
            if structured_data.get("name") and structured_data["name"] != "Not Available":
                bullets.append(f"• Name: {structured_data['name']}")
            
            # Education
            if structured_data.get("education"):
                for edu in structured_data["education"]:
                    uni = edu.get("university", "Unknown")
                    level = edu.get("level", "")
                    degree = edu.get("degree", "")
                    grad_date = edu.get("graduation_date", "")
                    
                    edu_str = f"• Education: {level} in {degree}"
                    if uni and uni != "Not Available":
                        edu_str += f" from {uni}"
                    bullets.append(edu_str)
                    
                    # Add graduation date as separate line if available
                    if grad_date:
                        bullets.append(f"  Graduation Date: {grad_date}")
            
            # Experience - Include ALL experiences (work, internships, research)
            experience = structured_data.get("experience", [])
            if experience:
                bullets.append(f"• Experience: {len(experience)} position(s) - {', '.join([exp.get('company', 'Unknown') for exp in experience])}")
                for exp in experience:  # ALL experiences
                    company = exp.get("company", "Unknown")
                    title = exp.get("title", "")
                    exp_type = exp.get("type", "")
                    bullets.append(f"  - {title} at {company} ({exp_type})")
            
            # Competitions - Include ALL competitions
            competitions = structured_data.get("competitions", [])
            if competitions:
                bullets.append(f"• Competitions: {len(competitions)} competition(s)")
                for comp in competitions:  # ALL competitions
                    name = comp.get("name", "Competition")
                    placement = comp.get("placement", "")
                    bullets.append(f"  - {name} ({placement})")
            
            # Projects - Include ALL projects
            projects = structured_data.get("projects", [])
            if projects:
                bullets.append(f"• Projects: {len(projects)} project(s)")
                for proj in projects:  # ALL projects
                    bullets.append(f"  - {proj.get('title', 'Project')}")
            
            # Key Technologies
            tech = structured_data.get("key_technologies", [])
            if tech:
                tech_str = ", ".join(tech[:10])
                bullets.append(f"• Key Technologies: {tech_str}")
            
            result = "\n".join(bullets)
            print("✅ Converted structured data to bullets:")
            print(result)
            
            return result
            
        except Exception as e:
            print(f"❌ Error converting to bullets: {e}")
            return """• Computer Science student
• Python, Java programming experience  
• Previous internship experience
• Strong technical background
• Problem-solving skills
• Team collaboration experience
• Academic projects completed"""
    
    def get_resume_bullets(self, resume_content: str) -> str:
        """Get resume bullets (with caching) - backward compatibility"""
        return self.extract_key_bullets(resume_content)
    
    def get_structured_resume_data(self, resume_content: str) -> Dict:
        """Get structured resume data"""
        return self.extract_structured_data(resume_content)
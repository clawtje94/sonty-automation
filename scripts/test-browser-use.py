#!/usr/bin/env python3
"""Test browser-use met Lenart's offerte in Reuzenpanda"""
import asyncio
import os
from browser_use import Agent, ChatAnthropic, BrowserProfile

api_key = open(os.path.join(os.path.dirname(__file__), '.anthropic-api-key.txt')).read().strip()

CHROME_PATH = os.path.expanduser("~/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")

async def main():
    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=api_key,
    )

    agent = Agent(
        task="""
        Ga naar https://hub.reuzenpanda.nl/login en log in:
        - Email: daimyboot@gmail.com (klik "Ga verder")
        - Wachtwoord: TQGb@eD%5nGRSN9@4Gss (klik "Inloggen")
        - Selecteer "Sonty B.V."

        Ga dan naar de deals pipeline.
        Zoek "Lenart" in de zoekbalk.
        Open de deal van Lenart Ahlhoff.

        Kijk of er 2 aparte "montage rolluik solar" regels staan in de offerte.
        Als dat zo is:
        - Open de offerte editor (drie puntjes naast het document, klik Bewerken)
        - Wijzig het aantal van de eerste montage van 1 naar 2
        - Verwijder de tweede/laatste montage regel (drie puntjes van die regel, klik Verwijderen)
        - Klik Opslaan

        Verplaats daarna de deal naar "Gecontroleerd" door op het juiste bolletje te klikken in de statusbalk bovenaan.
        Hover over de bolletjes om te lezen welke "Gecontroleerd" is.

        Sluit de deal (kruisje rechtsboven).

        Vertel mij wat je hebt gedaan.
        """,
        llm=llm,
        browser_profile=BrowserProfile(
            headless=False,
            executable_path=CHROME_PATH,
        ),
    )

    result = await agent.run()
    print("\n=== RESULTAAT ===")
    print(result)

asyncio.run(main())

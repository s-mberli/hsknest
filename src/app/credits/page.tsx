import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Credits & Licenses | HSK Nest",
  description:
    "Attribution for the open datasets that power HSK Nest's vocabulary decks, dictionary lookups, and example sentences.",
};

/**
 * License-required attribution page (linked from the site footer areas).
 * CC BY-SA and CC-BY data must be credited where it is actually served to
 * users — a repository README alone does not satisfy that.
 */
export default function CreditsPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-4xl font-bold mb-8">Data Credits &amp; Licenses</h1>

      <div className="prose prose-slate dark:prose-invert">
        <p className="lead">
          HSK Nest is built on outstanding open datasets. This page credits
          them as their licenses require — and because they deserve it.
        </p>

        <h2>HSK vocabulary</h2>
        <p>
          The HSK 1–9 and frequency word lists are derived from{" "}
          <a
            href="https://github.com/drkameleon/complete-hsk-vocabulary"
            target="_blank"
            rel="noopener noreferrer"
          >
            complete-hsk-vocabulary
          </a>{" "}
          by Yanis Zafirópulos, used under the{" "}
          <a
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
          .
        </p>

        <h2>Chinese–English dictionary</h2>
        <p>
          Word-entry suggestions for Chinese lists are powered by{" "}
          <a
            href="https://cc-cedict.org/wiki/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC-CEDICT
          </a>
          , © the CC-CEDICT editors and contributors, used under the{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution-ShareAlike 4.0 International License
          </a>{" "}
          (CC BY-SA 4.0). Our trimmed build of the dictionary data is shared
          under the same license in the{" "}
          <a
            href="https://github.com/s-mberli/recall"
            target="_blank"
            rel="noopener noreferrer"
          >
            open-source repository
          </a>
          .
        </p>

        <h2>Example sentences</h2>
        <p>
          Chinese–English example sentences come from{" "}
          <a
            href="https://tatoeba.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tatoeba
          </a>{" "}
          (via the{" "}
          <a
            href="https://www.manythings.org/anki/"
            target="_blank"
            rel="noopener noreferrer"
          >
            manythings.org sentence pairs
          </a>
          ), used under the{" "}
          <a
            href="https://creativecommons.org/licenses/by/2.0/fr/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC-BY 2.0 (France)
          </a>{" "}
          license. Each sentence stores its individual attribution
          (sentence IDs and contributor usernames), preserved verbatim in the
          app&apos;s database and data files.
        </p>

        <h2>Application code</h2>
        <p>
          HSK Nest itself is open source under the{" "}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.en.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            GNU AGPL-3.0
          </a>{" "}
          license —{" "}
          <a
            href="https://github.com/s-mberli/recall"
            target="_blank"
            rel="noopener noreferrer"
          >
            source code on GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}

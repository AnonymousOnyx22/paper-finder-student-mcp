Where it is meant to go: a student forum or Discord post about research tools (ready to paste)

Title: An arXiv MCP server vs the search I use for essays

I read a lot of preprints. If everything you cite is on arXiv, an arXiv MCP server is a good fit, and I would not talk you out of it.

My reading lists are not like that. They mix journal articles, conference papers and preprints, and the essay is judged on the argument, not on where the PDF lives. So I built Paper Finder MCP on OpenAlex, a free open catalog that includes arXiv preprints and journal articles in one index.

```bash
npx -y paper-finder-student-mcp
```

It runs in Claude Desktop, Cursor, VS Code or Claude Code, and you need Node.js 20 or newer. No account and no key.

Here is what `search_papers` returned when I asked for the most cited papers on spaced repetition:

```text
Papers about "spaced repetition", most cited first
Showing 1 to 3 of 12,408. Pass page 2 for the next page.

1. Spaced Repetition Promotes Efficient and Effective Learning (2016)
  Sean H. K. Kang, Policy Insights from the Behavioral and Brain Sciences
  405 citations. DOI 10.1177/2372732215624708. W2310690298
  No free copy found
  Abstract: Concern that students in the United States are less proficient in mathematics, science, and reading than their peers in other countries has led some to question whether American students spend enough...

2. A Trainable Spaced Repetition Model for Language Learning (2016)
  Burr Settles, Brendan Meeder, Annual Meeting of the Association for Computational Linguistics (ACL)
  217 citations. DOI 10.18653/v1/p16-1174. W2514897959
  Free to read, https://www.aclweb.org/anthology/P16-1174.pdf
  Abstract: We present half-life regression (HLR), a novel model for spaced repetition practice with applications to second language acquisition.HLR combines psycholinguistic theory with modern machine learning...

3. Enhancing human learning via spaced repetition optimization (2019)
  Behzad Tabibian, Utkarsh Upadhyay, Abir De, et al., Proceedings of the National Academy of Sciences
  181 citations. DOI 10.1073/pnas.1815156116. W2914319828
  Free to read, https://doi.org/10.1073/pnas.1815156116
  Abstract: Spaced repetition is a technique for efficient memorization which uses repeated review of content following a schedule determined by a spaced repetition algorithm to improve long-term retention.
```

The first result is a journal article. arXiv carries preprints, so that paper is only there if the author also uploaded a preprint. Paper Finder can give me the published work and a preprint when OpenAlex has both, with the venue, the citation count and a free to read link when one exists.

You can still ask for one kind of paper. `type: preprint` keeps a search to preprints, and `type: journal_article` keeps it to published articles. `find_citing_papers` and `paper_references` take arXiv DOIs too, so a paper like `10.48550/arXiv.1706.03762` can show what cites it and what it references in the same chat.

If your whole reading list is on arXiv, the arXiv server does the job. Mine is not, so one index saves me a second search. The counts move as OpenAlex updates, so your totals will differ from the sample. Always open the paper yourself before you cite it.

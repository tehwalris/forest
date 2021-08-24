// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/handbook-epub/script/createEpub.ts`

var markdowns: any;
var getHTML: any;
var replaceAllInString: any;
var Streampub: any;

const addHandbookPage = async (epub: any, id: string, index: number) => {
  const md = markdowns.get(id);
  if (!md)
    throw new Error(
      "Could not get " + id + " from " + Array.from(markdowns.keys()),
    );

  const title = md.data.title;
  const prefix = "<h1>" + title + "</h1><div>";
  const suffix = "</div>";
  const html = await getHTML(md.content, {});
  const edited = replaceAllInString(html, {
    'a href="/': 'a href="../',
  });

  epub.write(Streampub.newChapter(title, prefix + edited + suffix, index));
};

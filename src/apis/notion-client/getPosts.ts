import { CONFIG } from "site.config";
import { NotionAPI } from "notion-client";
import { idToUuid } from "notion-utils";

import getAllPageIds from "src/libs/utils/notion/getAllPageIds";
import getPageProperties from "src/libs/utils/notion/getPageProperties";
import { TPosts } from "src/types";

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 */

// TODO: react query를 사용해서 처음 불러온 뒤로는 해당 데이터만 사용하도록 수정
export const getPosts = async (): Promise<TPosts> => {
  try {
    let id = CONFIG.notionConfig.pageId as string;
    const api = new NotionAPI();

    // Notion API에서 페이지 데이터를 가져옵니다.
    const response = await api.getPage(id);
    
    if (!response) {
      throw new Error("No response from Notion API");
    }

    id = idToUuid(id);

    // collection과 block 데이터가 있는지 확인합니다.
    const collection = Object.values(response.collection || {})[0]?.value;
    const block = response.block || {};

    // schema가 없으면 빈 배열 반환
    const schema = collection?.schema;
    if (!schema) {
      console.warn("No schema found in Notion collection");
      return [];
    }

    if (!block[id]) {
      throw new Error(`Block with id ${id} not found`);
    }

    const rawMetadata = block[id]?.value;

    // Check Type
    if (
      rawMetadata?.type !== "collection_view_page" &&
      rawMetadata?.type !== "collection_view"
    ) {
      return [];
    }

    // 페이지 ID를 가져옵니다.
    const pageIds = getAllPageIds(response);
    const data = [];

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i];

      // 페이지 속성을 가져오고, 없으면 null로 설정합니다.
      const properties = (await getPageProperties(pageId, block, schema)) || null;

      if (properties) {
        // created_time 및 fullWidth 속성을 추가합니다.
        properties.createdTime = new Date(block[pageId]?.value?.created_time || 0).toString();
        properties.fullWidth = (block[pageId]?.value?.format as any)?.page_full_width ?? false;

        data.push(properties);
      }
    }

    // 데이터를 생성일 기준으로 정렬합니다.
    data.sort((a: any, b: any) => {
      const dateA = new Date(a?.date?.start_date || a.createdTime).getTime();
      const dateB = new Date(b?.date?.start_date || b.createdTime).getTime();
      return dateB - dateA;
    });

    const posts = data as TPosts;
    return posts;
    
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
};

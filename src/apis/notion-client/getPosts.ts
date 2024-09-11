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

    const response = await api.getPage(id);
    
    if (!response) {
      throw new Error("No response from Notion API");
    }

    id = idToUuid(id);

    const collection = Object.values(response.collection || {})[0]?.value;
    const block = response.block || {};

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

    // Get all page IDs
    const pageIds = getAllPageIds(response);
    const data = [];

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i];

      // Fetch page properties, fallback to null if not found
      const properties = (await getPageProperties(pageId, block, collection?.schema)) || null;

      if (properties) {
        // Check if block[pageId] and block[pageId].value exist before accessing
        const pageBlock = block[pageId]?.value;
        if (pageBlock) {
          properties.createdTime = new Date(pageBlock.created_time || 0).toString();
          properties.fullWidth = (pageBlock.format as any)?.page_full_width ?? false;
          data.push(properties);
        } else {
          console.warn(`No block value found for pageId: ${pageId}`);
        }
      }
    }

    // Sort data by date
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

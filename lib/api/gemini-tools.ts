import { handleOpenISearch, handleImageSeries } from './nih-openi';

export const tools = [
  {
    name: "searchMedicalImages",
    description: "Search for medical images in the NIH Open-I database",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query for finding medical images"
        },
        n: {
          type: "number",
          description: "Start index (1-based)",
          default: 1
        },
        m: {
          type: "number",
          description: "End index",
          default: 10
        },
        at: {
          type: "string",
          description: "Article type filter"
        },
        coll: {
          type: "string",
          description: "Collection filter"
        },
        favor: {
          type: "string",
          description: "Rank by preference"
        },
        fields: {
          type: "string",
          description: "Fields to search in"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "loadImageSeries",
    description: "Load and display an image series in the appropriate viewer (DICOM, image, or video)",
    parameters: {
      type: "object",
      properties: {
        imgId: {
          type: "string",
          description: "The ID of the image series to load"
        },
        type: {
          type: "string",
          description: "The type of viewer to use (dicom, image, or video). If not specified, will be determined automatically.",
          enum: ["dicom", "image", "video"]
        },
        format: {
          type: "string",
          description: "The format of the images (png, jpg, gif, dicom). If not specified, will be determined automatically.",
          enum: ["png", "jpg", "gif", "dicom"]
        },
        viewerId: {
          type: "string",
          description: "Optional ID of the specific viewer to load the series into"
        }
      },
      required: ["imgId"]
    }
  }
];

export const toolFunctions = {
  searchMedicalImages: async (params: string) => {
    return await handleOpenISearch(params);
  },
  loadImageSeries: async (params: string) => {
    return await handleImageSeries(params);
  }
}; 
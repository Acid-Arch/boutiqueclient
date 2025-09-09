import { j as json } from './index-Djsj11qr.js';

const GET = async ({ locals }) => {
  try {
    if (!locals.user) {
      return json(
        {
          success: false,
          error: "Not authenticated"
        },
        { status: 401 }
      );
    }
    return json({
      success: true,
      user: locals.user
    });
  } catch (error) {
    console.error("Get user API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error"
      },
      { status: 500 }
    );
  }
};

export { GET };
//# sourceMappingURL=_server.ts-BqfLU3En.js.map

import {
  ClientTransaction,
  fetchXDocument
} from "x-client-transaction-id";

type CheckState = "clear" | "banned" | "unknown" | "na";

export type ShadowbanItem = {
  state: CheckState;
  detail: string;
};

export type ShadowbanResult = {
  username: string;
  displayName: string;
  notFound: boolean;
  protected: boolean;
  suspended: boolean;
  tweetCount: number | null;
  checkedAt: string;
  checks: {
    mediaBan: ShadowbanItem;
    searchSensitiveBan: ShadowbanItem;
    searchSuggestionBan: ShadowbanItem;
    searchBan: ShadowbanItem;
    ghostBan: ShadowbanItem;
    replyDeboosting: ShadowbanItem;
  };
};

const PUBLIC_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const USER_BY_SCREEN_NAME_ID = "k5XapwcSikNsEsILW5FvgA";
const SEARCH_TIMELINE_ID = "AIdc203rPpK_k_2KWSdm7g";

const USER_FEATURES = {
  hidden_profile_likes_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true
};

const SEARCH_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false
};

let guestToken: { value: string; expiresAt: number } | null = null;

function cleanUsername(value: string): string {
  const username = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    throw new Error("有効なXの垢のIDを入力してください");
  }
  return username;
}

async function fetchTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 5_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getGuestToken(): Promise<string> {
  if (guestToken && guestToken.expiresAt > Date.now() + 60_000) {
    return guestToken.value;
  }

  const response = await fetchTimeout(
    "https://api.twitter.com/1.1/guest/activate.json",
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + PUBLIC_BEARER,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT
      }
    }
  );

  if (!response.ok) {
    throw new Error("Xの公開セッションを開始できませんでした");
  }

  const body = (await response.json()) as { guest_token?: string };
  if (!body.guest_token) {
    throw new Error("Xの公開セッション取得結果が不正です");
  }

  guestToken = {
    value: String(body.guest_token),
    expiresAt: Date.now() + 2.5 * 60 * 60_000
  };
  return guestToken.value;
}

async function createTransactionClient(): Promise<any> {
  const response = await fetchXDocument();
  return ClientTransaction.create(response);
}

async function xGet(
  path: string,
  searchParams: Record<string, string>,
  transactionClient: any
): Promise<any> {
  const url = new URL(path, "https://api.twitter.com/");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const transactionId = await transactionClient.generateTransactionId(
    "GET",
    url.pathname
  );

  const response = await fetchTimeout(url, {
    headers: {
      authorization: "Bearer " + PUBLIC_BEARER,
      "sec-ch-ua":
        '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      "user-agent": USER_AGENT,
      "x-client-transaction-id": transactionId,
      "x-guest-token": await getGuestToken(),
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "ja"
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("X側のレート制限中です");
    }
    throw new Error(
      "X API " + response.status + ": " + detail.slice(0, 160)
    );
  }

  return response.json();
}

function clear(detail: string): ShadowbanItem {
  return { state: "clear", detail };
}

function banned(detail: string): ShadowbanItem {
  return { state: "banned", detail };
}

function unknown(detail: string): ShadowbanItem {
  return { state: "unknown", detail };
}

function na(detail: string): ShadowbanItem {
  return { state: "na", detail };
}

function baseChecks(detail: string, state: CheckState): ShadowbanResult["checks"] {
  const item: ShadowbanItem = { state, detail };
  return {
    mediaBan: item,
    searchSensitiveBan: item,
    searchSuggestionBan: item,
    searchBan: item,
    ghostBan: item,
    replyDeboosting: item
  };
}

function displayNameFromUser(user: any, fallback: string): string {
  return String(
    user?.legacy?.name ??
      user?.core?.name ??
      user?.name ??
      fallback
  );
}

export async function checkShadowban(
  input: string
): Promise<ShadowbanResult> {
  const requestedUsername = cleanUsername(input);
  const transactionClient = await createTransactionClient();

  const userResponse = await xGet(
    "graphql/" + USER_BY_SCREEN_NAME_ID + "/UserByScreenName",
    {
      variables: JSON.stringify({
        screen_name: requestedUsername,
        withSafetyModeUserFields: true
      }),
      features: JSON.stringify(USER_FEATURES),
      fieldToggles: JSON.stringify({
        withAuxiliaryUserLabels: false
      })
    },
    transactionClient
  );

  const user = userResponse?.data?.user;
  const result = user?.result ?? null;
  const checkedAt = new Date().toISOString();

  // IRith's published implementation treats a missing "user" separately from
  // a non-User result. Keep those two states distinct.
  if (!user) {
    return {
      username: requestedUsername,
      displayName: requestedUsername,
      notFound: true,
      protected: false,
      suspended: false,
      tweetCount: null,
      checkedAt,
      checks: baseChecks("ユーザーが見つかりませんでした", "na")
    };
  }

  if (!result || result.__typename !== "User") {
    return {
      username: requestedUsername,
      displayName: displayNameFromUser(result, requestedUsername),
      notFound: false,
      protected: false,
      suspended: true,
      tweetCount: null,
      checkedAt,
      checks: baseChecks("ユーザーが凍結されています", "na")
    };
  }

  const legacy = result.legacy ?? {};
  const username = String(legacy.screen_name ?? requestedUsername);
  const displayName = displayNameFromUser(result, username);
  const tweetCount = Number.isFinite(Number(legacy.statuses_count))
    ? Number(legacy.statuses_count)
    : null;

  if (legacy.protected) {
    return {
      username,
      displayName,
      notFound: false,
      protected: true,
      suspended: false,
      tweetCount,
      checkedAt,
      checks: baseChecks("非公開アカウントのため判定対象外です", "na")
    };
  }

  if (!legacy.statuses_count) {
    return {
      username,
      displayName,
      notFound: false,
      protected: false,
      suspended: false,
      tweetCount,
      checkedAt,
      checks: baseChecks("ポストがないため判定対象外です", "na")
    };
  }

  const searchResponse = await xGet(
    "graphql/" + SEARCH_TIMELINE_ID + "/SearchTimeline",
    {
      variables: JSON.stringify({
        rawQuery: "from:" + username,
        count: 20,
        querySource: "typed_query",
        product: "Top"
      }),
      features: JSON.stringify(SEARCH_FEATURES)
    },
    transactionClient
  );

  const searchTimeline =
    searchResponse.data.search_by_raw_query.search_timeline;

  let searchBanFlag = true;
  for (const instruction of searchTimeline.timeline.instructions) {
    for (const entry of instruction.entries) {
      if (entry.entryId.startsWith("tweet-")) {
        if (
          entry.content.itemContent.tweet_results.result.core.user_results
            .result.legacy.screen_name === username
        ) {
          searchBanFlag = false;
          break;
        }
      }
    }
  }

  const suggestionResponse = await xGet(
    "1.1/search/typeahead.json",
    {
      include_ext_is_blue_verified: "1",
      include_ext_verified_type: "1",
      include_ext_profile_image_shape: "1",
      q: "@" + username + " " + displayName,
      src: "search_box",
      result_type: "events,users,topics,lists"
    },
    transactionClient
  );

  const suggestionUsers = Array.isArray(suggestionResponse?.users)
    ? suggestionResponse.users
    : [];

  let searchSuggestionBanFlag = true;
  for (const suggestionUser of suggestionUsers) {
    if (suggestionUser.screen_name === username) {
      searchSuggestionBanFlag = false;
      break;
    }
  }

  return {
    username,
    displayName,
    notFound: false,
    protected: false,
    suspended: false,
    tweetCount,
    checkedAt,
    checks: {
      // Current IRith calculates these server-side. The supplied client bundle
      // only receives the booleans; its private server-side formula is not
      // present in the bundle or the published repository.
      mediaBan: unknown("現行IRithのサーバー側判定式は公開されていません"),
      searchSensitiveBan: unknown(
        "現行IRithのサーバー側判定式は公開されていません"
      ),
      searchSuggestionBan: searchSuggestionBanFlag
        ? banned("検索候補に本人のアカウントが見つかりませんでした")
        : clear("検索候補に本人のアカウントを確認できました"),
      searchBan: searchBanFlag
        ? banned("Top検索に本人のポストが見つかりませんでした")
        : clear("Top検索に本人のポストを確認できました"),
      ghostBan: unknown("本家では現在メンテナンス中です"),
      replyDeboosting: unknown("本家では現在メンテナンス中です")
    }
  };
}

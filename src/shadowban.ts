type CheckState = "clear" | "banned" | "unknown" | "na";

export type ShadowbanItem = {
  state: CheckState;
  detail: string;
};

export type ShadowbanResult = {
  username: string;
  displayName: string;
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

type CheckOptions = {
  authToken: string;
};

const PUBLIC_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const OPERATION_IDS: Record<
  "UserByScreenName" | "UserTweets" | "SearchTimeline" | "TweetDetail",
  string
> = {
  UserByScreenName: "Gb-d6r0vxPOADdG62OEBpQ",
  UserTweets: "SXVCYB8XHSS25nzIljNtZA",
  SearchTimeline: "hyPfJYJ_XAtDYoslQc-Rgg",
  TweetDetail: "XMOz5h24KAZ86qKffKTLdQ"
};

const FEATURES: Record<string, boolean> = {
  articles_preview_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  content_disclosure_indicator_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  post_ctas_fetch_enabled: false,
  premium_content_api_read_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_birdwatch_enforce_author_user_quotas: true,
  responsive_web_birdwatch_fast_notes_badge_enabled: false,
  responsive_web_birdwatch_live_note_enabled: true,
  responsive_web_birdwatch_media_notes_enabled: true,
  responsive_web_birdwatch_note_internal_insights_enabled: false,
  responsive_web_birdwatch_note_limit_enabled: true,
  responsive_web_birdwatch_note_request_download_enabled: true,
  responsive_web_birdwatch_note_request_sources_enabled: true,
  responsive_web_birdwatch_signup_prompt_enabled: true,
  responsive_web_birdwatch_top_contributor_enabled: true,
  responsive_web_birdwatch_translation_enabled: true,
  responsive_web_birdwatch_url_notes_enabled: false,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_grok_community_note_translation_is_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_profile_redirect_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  rweb_cashtags_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  rweb_video_screen_enabled: false,
  spaces_2022_h2_clipping: true,
  spaces_2022_h2_spaces_communities: true,
  standardized_nudges_misinfo: true,
  subscriptions_feature_can_gift_premium: true,
  subscriptions_management_fetch_next_billing_time: true,
  subscriptions_marketing_page_fetch_promotions: true,
  subscriptions_upsells_api_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
  view_counts_everywhere_api_enabled: true
};

let queryIdsRefreshedAt = 0;
let queryRefreshPromise: Promise<void> | null = null;
const sessionCsrfToken = randomHex(16);

function randomHex(bytes: number): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function cleanUsername(value: string): string {
  const username = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    throw new Error("有効なXユーザー名を入力してください");
  }
  return username;
}

function cleanAuthToken(value: string): string {
  const token = value.trim();
  if (token.length < 20 || /[\s;]/.test(token)) {
    throw new Error("Xチェック用auth_tokenが未設定または不正です");
  }
  return token;
}

async function fetchTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 3_500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function xHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: "Bearer " + decodeURIComponent(PUBLIC_BEARER),
    "X-CSRF-Token": sessionCsrfToken,
    "X-Twitter-Active-User": "yes",
    "X-Twitter-Auth-Type": "OAuth2Session",
    "X-Twitter-Client-Language": "ja",
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    Origin: "https://x.com",
    Referer: "https://x.com/",
    Cookie: "auth_token=" + authToken + "; ct0=" + sessionCsrfToken
  };
}

async function discoverCurrentQueryIds(): Promise<void> {
  if (Date.now() - queryIdsRefreshedAt < 5 * 60_000) return;
  if (queryRefreshPromise) return queryRefreshPromise;

  queryRefreshPromise = (async () => {
    const entryUrls = [
      "https://x.com/home",
      "https://x.com/i/flow/login",
      "https://twitter.com/home"
    ];

    const attempts = entryUrls.map(async (url) => {
      const response = await fetchTimeout(
        url,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          },
          redirect: "follow"
        },
        3_000
      );
      if (!response.ok) throw new Error("entry HTTP " + response.status);
      const html = await response.text();
      const match = html.match(
        /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/main\.([a-z0-9]+)\.js/i
      );
      if (!match) throw new Error("main bundle not found");
      return match[0];
    });

    let mainUrl = "";
    try {
      mainUrl = await Promise.any(attempts);
    } catch {
      return;
    }

    try {
      const response = await fetchTimeout(
        mainUrl,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "*/*" }
        },
        4_500
      );
      if (!response.ok) return;
      const source = await response.text();
      const operationPattern =
        /queryId:"([A-Za-z0-9_-]+)",operationName:"([A-Za-z0-9_]+)",operationType:"(query|mutation|subscription)"/g;
      let updated = 0;
      for (const match of source.matchAll(operationPattern)) {
        const operationName = match[2] as keyof typeof OPERATION_IDS;
        if (operationName in OPERATION_IDS) {
          OPERATION_IDS[operationName] = match[1]!;
          updated++;
        }
      }
      if (updated > 0) queryIdsRefreshedAt = Date.now();
    } catch {
      // Keep the last known-good IDs.
    }
  })().finally(() => {
    queryRefreshPromise = null;
  });

  return queryRefreshPromise;
}

async function graphqlRequest(
  operationName: keyof typeof OPERATION_IDS,
  variables: Record<string, unknown>,
  authToken: string,
  retried = false
): Promise<any> {
  const queryId = OPERATION_IDS[operationName];
  const base =
    "https://x.com/i/api/graphql/" +
    encodeURIComponent(queryId) +
    "/" +
    encodeURIComponent(operationName);
  const headers = xHeaders(authToken);
  let response: Response;

  if (operationName === "SearchTimeline") {
    response = await fetchTimeout(base, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        variables,
        features: FEATURES,
        queryId
      })
    });
  } else {
    const url = new URL(base);
    url.searchParams.set("variables", JSON.stringify(variables));
    url.searchParams.set("features", JSON.stringify(FEATURES));
    if (operationName === "UserByScreenName") {
      url.searchParams.set(
        "fieldToggles",
        JSON.stringify({ withAuxiliaryUserLabels: false })
      );
    }
    response = await fetchTimeout(url, { headers });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Xチェック用auth_tokenが無効・期限切れ、またはX側に拒否されました"
      );
    }
    if (response.status === 429) {
      throw new Error("X側のレート制限中です");
    }

    const staleId =
      response.status === 404 ||
      (response.status === 400 &&
        /query|persisted|operation/i.test(detail));
    if (!retried && staleId) {
      queryIdsRefreshedAt = 0;
      await discoverCurrentQueryIds();
      return graphqlRequest(operationName, variables, authToken, true);
    }

    throw new Error(
      "X API " + response.status + ": " + detail.slice(0, 160)
    );
  }

  const payload = await response.json();
  const errorText =
    payload && typeof payload === "object" && "errors" in payload
      ? JSON.stringify((payload as any).errors ?? "")
      : "";

  if (/auth|unauthorized|forbidden|login/i.test(errorText)) {
    throw new Error(
      "Xチェック用auth_tokenが無効・期限切れ、またはX側に拒否されました"
    );
  }

  if (!retried && /query|persisted|operation/i.test(errorText)) {
    queryIdsRefreshedAt = 0;
    await discoverCurrentQueryIds();
    return graphqlRequest(operationName, variables, authToken, true);
  }

  return payload;
}

type SearchTweet = {
  id: string;
  username: string | null;
  parentId: string | null;
  conversationId: string | null;
  hasMedia: boolean;
  possiblySensitive: boolean | null;
};

function unwrapTweetResult(result: any): any {
  let value = result;
  for (let i = 0; i < 4; i++) {
    if (!value || typeof value !== "object") break;
    if (value.__typename === "TweetWithVisibilityResults" && value.tweet) {
      value = value.tweet;
      continue;
    }
    if (value.tweet) {
      value = value.tweet;
      continue;
    }
    break;
  }
  return value;
}

function tweetFromResult(result: any): SearchTweet | null {
  const tweet = unwrapTweetResult(result);
  const legacy = tweet?.legacy;
  const id = String(tweet?.rest_id ?? legacy?.id_str ?? "");
  if (!id || !legacy) return null;

  const username =
    tweet?.core?.user_results?.result?.legacy?.screen_name ??
    tweet?.core?.user_results?.result?.core?.screen_name ??
    tweet?.core?.user_results?.result?.screen_name ??
    null;

  const media =
    legacy?.extended_entities?.media ??
    legacy?.entities?.media ??
    [];

  return {
    id,
    username: username ? String(username) : null,
    parentId: legacy.in_reply_to_status_id_str
      ? String(legacy.in_reply_to_status_id_str)
      : null,
    conversationId: legacy.conversation_id_str
      ? String(legacy.conversation_id_str)
      : null,
    hasMedia: Array.isArray(media) && media.length > 0,
    possiblySensitive:
      typeof legacy.possibly_sensitive === "boolean"
        ? legacy.possibly_sensitive
        : null
  };
}

function collectTweetResults(root: any): SearchTweet[] {
  const out: SearchTweet[] = [];
  const seenObjects = new Set<object>();
  const seenIds = new Set<string>();

  const walk = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    const result = value?.tweet_results?.result;
    if (result) {
      const parsed = tweetFromResult(result);
      if (parsed && !seenIds.has(parsed.id)) {
        seenIds.add(parsed.id);
        out.push(parsed);
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const child of Object.values(value)) walk(child);
  };

  walk(root);
  return out;
}

function sameUser(tweet: SearchTweet, username: string): boolean {
  return (
    typeof tweet.username === "string" &&
    tweet.username.toLowerCase() === username.toLowerCase()
  );
}

async function searchTweets(
  rawQuery: string,
  product: "Latest" | "Top" | "People",
  username: string,
  authToken: string
): Promise<SearchTweet[]> {
  const payload = await graphqlRequest(
    "SearchTimeline",
    {
      rawQuery,
      count: 20,
      querySource: "typed_query",
      product
    },
    authToken
  );
  return collectTweetResults(payload).filter((tweet) =>
    sameUser(tweet, username)
  );
}

async function profileByUsername(
  username: string,
  authToken: string
): Promise<{
  userId: string | null;
  displayName: string;
  protected: boolean;
  suspended: boolean;
  tweetCount: number | null;
}> {
  const payload = await graphqlRequest(
    "UserByScreenName",
    {
      screen_name: username,
      withSafetyModeUserFields: true
    },
    authToken
  );
  const user = payload?.data?.user?.result;
  if (!user) throw new Error("Xアカウントが見つかりません");

  if (user.__typename !== "User") {
    const unavailableText = JSON.stringify(user).toLowerCase();
    if (!/suspend|withheld|unavailable/.test(unavailableText)) {
      throw new Error(
        "Xアカウントが見つからないか、公開情報を取得できません"
      );
    }
    return {
      userId: null,
      displayName: username,
      protected: false,
      suspended: true,
      tweetCount: null
    };
  }

  const legacy = user.legacy ?? {};
  const core = user.core ?? {};
  return {
    userId: user.rest_id ? String(user.rest_id) : null,
    displayName: String(legacy.name ?? core.name ?? username),
    protected: Boolean(legacy.protected),
    suspended: false,
    tweetCount:
      Number.isFinite(Number(legacy.statuses_count))
        ? Number(legacy.statuses_count)
        : null
  };
}

async function userTweets(
  userId: string,
  username: string,
  authToken: string
): Promise<SearchTweet[]> {
  const payload = await graphqlRequest(
    "UserTweets",
    {
      userId,
      count: 20,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true
    },
    authToken
  );
  return collectTweetResults(payload).filter((tweet) =>
    sameUser(tweet, username)
  );
}

async function searchSuggestionVisible(
  username: string,
  displayName: string,
  authToken: string
): Promise<boolean> {
  const endpoints = [
    "https://api.x.com/1.1/search/typeahead.json",
    "https://x.com/i/api/1.1/search/typeahead.json"
  ];
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set(
        "q",
        ("@" + username + " " + displayName).trim()
      );
      url.searchParams.set("src", "search_box");
      url.searchParams.set("result_type", "events,users,topics,lists");
      url.searchParams.set("include_ext_is_blue_verified", "1");
      url.searchParams.set("include_ext_verified_type", "1");
      url.searchParams.set("include_ext_profile_image_shape", "1");

      const response = await fetchTimeout(url, {
        headers: xHeaders(authToken)
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Xチェック用auth_tokenが無効・期限切れ、またはX側に拒否されました"
        );
      }
      if (!response.ok) {
        lastError = new Error("typeahead HTTP " + response.status);
        continue;
      }

      const payload = (await response.json()) as any;
      const users = Array.isArray(payload?.users) ? payload.users : [];
      return users.some(
        (user: any) =>
          String(user?.screen_name ?? "").toLowerCase() ===
          username.toLowerCase()
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("検索候補を取得できませんでした");
}

function collectShowMoreCursors(root: any): string[] {
  const cursors = new Set<string>();
  const seen = new Set<object>();

  const walk = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    const entryId = String(value.entryId ?? "");
    const cursorType = String(
      value.cursorType ??
        value?.content?.cursorType ??
        value?.itemContent?.cursorType ??
        ""
    );
    const cursorValue =
      value.value ??
      value?.content?.value ??
      value?.itemContent?.value ??
      null;

    if (
      cursorValue &&
      (/showmorethreads/i.test(cursorType) ||
        /cursor-showmorethreads/i.test(entryId))
    ) {
      cursors.add(String(cursorValue));
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const child of Object.values(value)) walk(child);
  };

  walk(root);
  return [...cursors];
}

async function tweetDetail(
  focalTweetId: string,
  authToken: string,
  cursor?: string
): Promise<any> {
  const variables: Record<string, unknown> = {
    focalTweetId,
    with_rux_injections: false,
    rankingMode: "Relevance",
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true
  };
  if (cursor) variables.cursor = cursor;
  return graphqlRequest("TweetDetail", variables, authToken);
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

export async function checkShadowban(
  input: string,
  options: CheckOptions
): Promise<ShadowbanResult> {
  const username = cleanUsername(input);
  const authToken = cleanAuthToken(options.authToken);
  const profile = await profileByUsername(username, authToken);

  const checks: ShadowbanResult["checks"] = {
    mediaBan: unknown("まだ判定していません"),
    searchSensitiveBan: unknown("まだ判定していません"),
    searchSuggestionBan: unknown("まだ判定していません"),
    searchBan: unknown("まだ判定していません"),
    ghostBan: unknown("まだ判定していません"),
    replyDeboosting: unknown("まだ判定していません")
  };

  if (profile.suspended) {
    const item = unknown("アカウントが利用不能のため判定できません");
    return {
      username,
      displayName: profile.displayName,
      protected: false,
      suspended: true,
      tweetCount: profile.tweetCount,
      checkedAt: new Date().toISOString(),
      checks: {
        mediaBan: item,
        searchSensitiveBan: item,
        searchSuggestionBan: item,
        searchBan: item,
        ghostBan: item,
        replyDeboosting: item
      }
    };
  }

  if (profile.protected) {
    const item = na("非公開アカウントは外部検索から判定できません");
    return {
      username,
      displayName: profile.displayName,
      protected: true,
      suspended: false,
      tweetCount: profile.tweetCount,
      checkedAt: new Date().toISOString(),
      checks: {
        mediaBan: item,
        searchSensitiveBan: item,
        searchSuggestionBan: item,
        searchBan: item,
        ghostBan: item,
        replyDeboosting: item
      }
    };
  }

  const [profileTweetsResult, latestResult, suggestionResult] =
    await Promise.allSettled([
      profile.userId
        ? userTweets(profile.userId, username, authToken)
        : Promise.resolve([] as SearchTweet[]),
      searchTweets(
        "from:" + username,
        "Latest",
        username,
        authToken
      ),
      searchSuggestionVisible(
        username,
        profile.displayName,
        authToken
      )
    ]);

  const profileTweets =
    profileTweetsResult.status === "fulfilled"
      ? profileTweetsResult.value
      : null;
  const latest =
    latestResult.status === "fulfilled"
      ? latestResult.value
      : null;

  if (latestResult.status === "rejected") {
    checks.searchBan = unknown(
      "検索結果を取得できません: " +
        (latestResult.reason instanceof Error
          ? latestResult.reason.message
          : String(latestResult.reason))
    );
  } else if (latestResult.value.length > 0) {
    checks.searchBan = clear("最新検索で本人のポストを確認できました");
  } else if (profileTweets && profileTweets.length > 0) {
    checks.searchBan = banned(
      "プロフィールには最近の公開ポストがありますが、最新検索で確認できませんでした"
    );
  } else if ((profile.tweetCount ?? 0) === 0) {
    checks.searchBan = na("公開ポストがないため判定対象がありません");
  } else {
    checks.searchBan = unknown(
      "投稿数はありますが、比較できる最近の公開ポストを取得できませんでした"
    );
  }

  if (suggestionResult.status === "fulfilled") {
    checks.searchSuggestionBan = suggestionResult.value
      ? clear("検索候補にアカウントを確認できました")
      : banned("検索候補にアカウントを確認できませんでした");
  } else {
    checks.searchSuggestionBan = unknown(
      "検索候補を取得できません: " +
        (suggestionResult.reason instanceof Error
          ? suggestionResult.reason.message
          : String(suggestionResult.reason))
    );
  }

  await Promise.all([
    (async () => {
      try {
        if (latest && latest.length > 0) {
          const safe = await searchTweets(
            "from:" + username + " filter:safe",
            "Latest",
            username,
            authToken
          );
          checks.searchSensitiveBan =
            safe.length > 0
              ? clear("セーフ検索でも本人のポストを確認できました")
              : banned(
                  "通常検索では表示されますがセーフ検索では確認できません"
                );
          return;
        }

        if ((profile.tweetCount ?? 0) === 0) {
          checks.searchSensitiveBan = na(
            "公開ポストがないため判定対象がありません"
          );
          return;
        }

        const sensitivity =
          profileTweets?.find((tweet) => tweet.possiblySensitive !== null)
            ?.possiblySensitive ?? null;
        checks.searchSensitiveBan =
          sensitivity === true
            ? banned("最近の公開ポストにセンシティブ判定を確認しました")
            : sensitivity === false
              ? clear(
                  "最近の公開ポストにセンシティブ判定は確認されませんでした"
                )
              : unknown(
                  "セーフ検索との比較ができず、センシティブ判定情報も取得できません"
                );
      } catch (error) {
        checks.searchSensitiveBan = unknown(
          "セーフ検索を比較できません: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    })(),

    (async () => {
      try {
        if (!profileTweets) {
          checks.mediaBan = unknown(
            "プロフィール側の最近のポストを取得できません"
          );
          return;
        }

        const profileMedia = profileTweets.filter(
          (tweet) => tweet.hasMedia
        );
        if (profileMedia.length === 0) {
          checks.mediaBan = na(
            "判定に使える最近のメディア投稿がありません"
          );
          return;
        }

        const searchedMedia = await searchTweets(
          "from:" + username + " filter:media",
          "Latest",
          username,
          authToken
        );
        const searchedIds = new Set(
          searchedMedia.map((tweet) => tweet.id)
        );
        const matched = profileMedia.some((tweet) =>
          searchedIds.has(tweet.id)
        );

        checks.mediaBan = matched
          ? clear(
              "プロフィールの最近のメディア投稿をメディア検索でも確認できました"
            )
          : banned(
              "プロフィールには最近のメディア投稿がありますが、メディア検索で確認できませんでした"
            );
      } catch (error) {
        checks.mediaBan = unknown(
          "メディア検索を比較できません: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    })(),

    (async () => {
      try {
        const replyCandidates = await searchTweets(
          "from:" + username + " filter:replies",
          "Latest",
          username,
          authToken
        );
        const target = replyCandidates.find((tweet) =>
          Boolean(tweet.parentId)
        );

        if (!target?.parentId) {
          if (checks.searchBan.state === "banned") {
            checks.ghostBan = unknown(
              "Search Banが検出されているため、返信候補を検索から取得できません"
            );
            checks.replyDeboosting = unknown(
              "Search Banが検出されているため、返信表示順位を判定できません"
            );
          } else {
            checks.ghostBan = na(
              "判定に使える最近の返信がありません"
            );
            checks.replyDeboosting = na(
              "判定に使える最近の返信がありません"
            );
          }
          return;
        }

        const first = await tweetDetail(
          target.parentId,
          authToken
        );
        const initialIds = new Set(
          collectTweetResults(first).map((tweet) => tweet.id)
        );

        if (initialIds.has(target.id)) {
          checks.ghostBan = clear(
            "返信スレッドで対象リプライを確認できました"
          );
          checks.replyDeboosting = clear(
            "対象リプライは初期表示範囲で確認できました"
          );
          return;
        }

        const cursor = collectShowMoreCursors(first)[0];
        if (!cursor) {
          checks.ghostBan = unknown(
            "返信検索では存在しますが、スレッド初期表示で確認できませんでした"
          );
          checks.replyDeboosting = unknown(
            "追加返信カーソルがなく、表示順位を確定できません"
          );
          return;
        }

        const page = await tweetDetail(
          target.parentId,
          authToken,
          cursor
        );
        const ids = new Set(
          collectTweetResults(page).map((tweet) => tweet.id)
        );

        if (ids.has(target.id)) {
          checks.ghostBan = clear(
            "追加返信を開くと対象リプライを確認できました"
          );
          checks.replyDeboosting = banned(
            "対象リプライが初期表示から外れ、追加返信側で確認されました"
          );
        } else {
          checks.ghostBan = banned(
            "返信検索では存在しますが、スレッドと追加返信で確認できませんでした"
          );
          checks.replyDeboosting = unknown(
            "対象返信を確認できないため、降格だけを分離判定できません"
          );
        }
      } catch (error) {
        const detail =
          "返信スレッドを確認できません: " +
          (error instanceof Error ? error.message : String(error));
        checks.ghostBan = unknown(detail);
        checks.replyDeboosting = unknown(detail);
      }
    })()
  ]);

  return {
    username,
    displayName: profile.displayName,
    protected: profile.protected,
    suspended: profile.suspended,
    tweetCount: profile.tweetCount,
    checkedAt: new Date().toISOString(),
    checks
  };
}

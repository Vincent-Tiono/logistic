export interface HttpResponse {
  status: number;
  location: string | null;
  body: string;
}

/** Minimal single-cookie-jar client: form POSTs, manual redirects. */
export class HttpClient {
  private cookie: string | null = null;

  constructor(private readonly baseUrl: string) {}

  private capture(res: Response) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
  }

  async get(path: string): Promise<HttpResponse> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      redirect: "manual",
      headers: this.cookie ? { cookie: this.cookie } : {},
    });
    this.capture(res);
    return {
      status: res.status,
      location: res.headers.get("location"),
      body: await res.text(),
    };
  }

  async postForm(
    path: string,
    fields: Record<string, string>
  ): Promise<HttpResponse> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: new URLSearchParams(fields).toString(),
    });
    this.capture(res);
    return {
      status: res.status,
      location: res.headers.get("location"),
      body: await res.text(),
    };
  }

  async postJsonForm<T = unknown>(
    path: string,
    fields: Record<string, string>
  ): Promise<T> {
    const res = await this.postForm(path, fields);
    return JSON.parse(res.body) as T;
  }
}

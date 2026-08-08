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

  async postJsonBody<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    this.capture(res);
    return JSON.parse(await res.text()) as T;
  }

  async postMultipart(
    path: string,
    fields: Record<string, string>,
    file: { fieldName: string; filename: string; content: string }
  ): Promise<HttpResponse> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append(
      file.fieldName,
      new Blob([file.content], { type: "text/csv" }),
      file.filename
    );

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: this.cookie ? { cookie: this.cookie } : {},
      body: fd,
    });
    this.capture(res);
    return {
      status: res.status,
      location: res.headers.get("location"),
      body: await res.text(),
    };
  }

  async postJsonMultipart<T = unknown>(
    path: string,
    fields: Record<string, string>,
    file: { fieldName: string; filename: string; content: string }
  ): Promise<T> {
    const res = await this.postMultipart(path, fields, file);
    return JSON.parse(res.body) as T;
  }
}

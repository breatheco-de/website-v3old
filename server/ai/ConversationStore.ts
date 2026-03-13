import { db } from "../db";
import { conversations, conversationMessages, aiKnowledge } from "@shared/schema";
import type { InsertConversation, InsertConversationMessage, Conversation, ConversationMessage } from "@shared/schema";
import { eq, desc, and, gte, lte, like, sql, type SQL } from "drizzle-orm";
import { gcs } from "../gcs";

export class ConversationStore {
  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values(data).returning();
    return conv;
  }

  async addMessage(data: InsertConversationMessage): Promise<ConversationMessage> {
    const [msg] = await db.insert(conversationMessages).values(data).returning();
    return msg;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv || null;
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    return db.select().from(conversationMessages)
      .where(eq(conversationMessages.conversation_id, conversationId))
      .orderBy(conversationMessages.created_at);
  }

  async rateMessage(
    messageId: string,
    rating: "good" | "bad",
    ratedBy: string
  ): Promise<ConversationMessage | null> {
    const [msg] = await db.update(conversationMessages)
      .set({
        rating,
        rated_by: ratedBy,
        rated_at: new Date(),
      })
      .where(eq(conversationMessages.id, messageId))
      .returning();
    return msg || null;
  }

  async overrideMessage(
    messageId: string,
    overrideContent: string,
    overrideBy: string
  ): Promise<ConversationMessage | null> {
    const [msg] = await db.update(conversationMessages)
      .set({
        override_content: overrideContent,
        override_by: overrideBy,
        override_at: new Date(),
      })
      .where(eq(conversationMessages.id, messageId))
      .returning();
    return msg || null;
  }

  async listConversations(filters: {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    pageUrl?: string;
    featureTag?: string;
    questionTag?: string;
    rating?: string;
  }): Promise<{ conversations: (Conversation & { messages: ConversationMessage[] })[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (filters.dateFrom) {
      conditions.push(gte(conversations.started_at, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(conversations.started_at, new Date(filters.dateTo)));
    }
    if (filters.pageUrl) {
      conditions.push(like(conversations.page_url, `%${filters.pageUrl}%`));
    }
    if (filters.featureTag) {
      conditions.push(sql`${filters.featureTag} = ANY(${conversations.feature_tags})`);
    }
    if (filters.questionTag) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${conversationMessages} WHERE ${conversationMessages.conversation_id} = ${conversations.id} AND ${conversationMessages.question_tag} = ${filters.questionTag})`
      );
    }
    if (filters.rating) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${conversationMessages} WHERE ${conversationMessages.conversation_id} = ${conversations.id} AND ${conversationMessages.rating} = ${filters.rating})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(whereClause);

    const convList = await db.select().from(conversations)
      .where(whereClause)
      .orderBy(desc(conversations.started_at))
      .limit(limit)
      .offset(offset);

    const result: (Conversation & { messages: ConversationMessage[] })[] = [];

    for (const conv of convList) {
      const msgs = await this.getMessages(conv.id);
      result.push({ ...conv, messages: msgs });
    }

    return {
      conversations: result,
      total: Number(countResult?.count || 0),
    };
  }

  async getRecentUserMessages(limit: number = 100): Promise<{ content: string; question_tag: string | null; conversation_id: string }[]> {
    const msgs = await db.select({
      content: conversationMessages.content,
      question_tag: conversationMessages.question_tag,
      conversation_id: conversationMessages.conversation_id,
    })
      .from(conversationMessages)
      .where(eq(conversationMessages.role, "user"))
      .orderBy(desc(conversationMessages.created_at))
      .limit(limit);
    return msgs;
  }

  async saveContextSnapshot(conversationId: string, context: Record<string, unknown>): Promise<void> {
    if (!gcs.available) return;
    try {
      const key = `conversations/${conversationId}/context.json`;
      await gcs.upload(key, Buffer.from(JSON.stringify(context, null, 2)), "application/json");
    } catch (err) {
      console.error("[ConversationStore] Failed to save context snapshot:", err);
    }
  }

  async getKnowledge(key: string): Promise<unknown | null> {
    const [row] = await db.select().from(aiKnowledge).where(eq(aiKnowledge.key, key));
    return row?.value || null;
  }

  async setKnowledge(key: string, value: unknown, updatedBy?: string): Promise<void> {
    const existing = await db.select().from(aiKnowledge).where(eq(aiKnowledge.key, key));
    if (existing.length > 0) {
      await db.update(aiKnowledge)
        .set({ value, updated_at: new Date(), updated_by: updatedBy })
        .where(eq(aiKnowledge.key, key));
    } else {
      await db.insert(aiKnowledge).values({ key, value, updated_by: updatedBy });
    }
  }

  async getAllKnowledge(): Promise<Record<string, unknown>> {
    const rows = await db.select().from(aiKnowledge);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}

export const conversationStore = new ConversationStore();

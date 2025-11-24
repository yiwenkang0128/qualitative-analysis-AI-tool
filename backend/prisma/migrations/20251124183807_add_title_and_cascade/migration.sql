-- DropForeignKey
ALTER TABLE "ChatHistory" DROP CONSTRAINT "ChatHistory_documentId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Unnamed Chat';

-- AddForeignKey
ALTER TABLE "ChatHistory" ADD CONSTRAINT "ChatHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

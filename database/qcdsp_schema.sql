--
-- PostgreSQL database dump
--

\restrict LH8l45fJxiUWVbhrAa1DgEmWV8RWNqcyl9H8zAWz1ZHL5OTKm5WX0tlYjBt47Id

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(80) NOT NULL,
    password_hash text NOT NULL,
    name character varying(150) NOT NULL,
    role character varying(30) DEFAULT 'admin'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_role_check CHECK (((role)::text = ANY ((ARRAY['super_admin'::character varying, 'admin'::character varying, 'pr_viewer'::character varying])::text[])))
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_request_id uuid NOT NULL,
    attachment_type character varying(30) NOT NULL,
    original_name character varying(255) NOT NULL,
    stored_name character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    size_bytes bigint NOT NULL,
    file_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_attachment_type_check CHECK (((attachment_type)::text = ANY (ARRAY[('spv_approval'::character varying)::text, ('quotation'::character varying)::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(150) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(300) NOT NULL,
    category_id uuid NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    content_type character varying(20) NOT NULL,
    pdf_file_path text,
    pdf_original_name character varying(255),
    pdf_size_bytes bigint,
    article_content text,
    is_published boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, (((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text)))) STORED,
    CONSTRAINT chk_knowledge_article_content CHECK ((((content_type)::text <> 'article'::text) OR ((article_content IS NOT NULL) AND (length(article_content) > 0)))),
    CONSTRAINT chk_knowledge_pdf_file CHECK ((((content_type)::text <> 'pdf'::text) OR ((pdf_file_path IS NOT NULL) AND (length(pdf_file_path) > 0)))),
    CONSTRAINT chk_knowledge_pdf_size CHECK (((pdf_size_bytes IS NULL) OR (pdf_size_bytes <= 10485760))),
    CONSTRAINT knowledge_documents_content_type_check CHECK (((content_type)::text = ANY (ARRAY[('pdf'::character varying)::text, ('article'::character varying)::text])))
);


--
-- Name: purchase_request_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_request_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    notes text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_request_status_history_status_check CHECK (((status)::text = ANY (ARRAY[('Submitted'::character varying)::text, ('Review'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Ordered'::character varying)::text, ('Received'::character varying)::text, ('Closed'::character varying)::text])))
);


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_number character varying(40) NOT NULL,
    description text NOT NULL,
    order_type character varying(50) NOT NULL,
    custom_order_type character varying(120),
    brand_catalog character varying(255) NOT NULL,
    quantity integer NOT NULL,
    requester_name character varying(150) NOT NULL,
    reason text NOT NULL,
    status character varying(30) DEFAULT 'Submitted'::character varying NOT NULL,
    internal_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pr_custom_order_type CHECK ((((order_type)::text <> 'Lain-Lain'::text) OR ((custom_order_type IS NOT NULL) AND (length(btrim((custom_order_type)::text)) > 0)))),
    CONSTRAINT purchase_requests_order_type_check CHECK (((order_type)::text = ANY (ARRAY[('Reagen'::character varying)::text, ('Tools'::character varying)::text, ('Expense Item'::character varying)::text, ('Reagen Mikro'::character varying)::text, ('Tools Mikro'::character varying)::text, ('RS/Reference Standard'::character varying)::text, ('Gas'::character varying)::text, ('Analisa External'::character varying)::text, ('Lain-Lain'::character varying)::text]))),
    CONSTRAINT purchase_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT purchase_requests_status_check CHECK (((status)::text = ANY (ARRAY[('Submitted'::character varying)::text, ('Review'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Ordered'::character varying)::text, ('Received'::character varying)::text, ('Closed'::character varying)::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_slug_key UNIQUE (slug);


--
-- Name: purchase_request_status_history purchase_request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_reference_number_key UNIQUE (reference_number);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_admin_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_role ON public.admin_users USING btree (role);


--
-- Name: idx_admin_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_username ON public.admin_users USING btree (lower((username)::text));


--
-- Name: idx_attachments_purchase_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_purchase_request_id ON public.attachments USING btree (purchase_request_id);


--
-- Name: idx_attachments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_type ON public.attachments USING btree (attachment_type);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_knowledge_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_category_id ON public.knowledge_documents USING btree (category_id);


--
-- Name: idx_knowledge_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_content_type ON public.knowledge_documents USING btree (content_type);


--
-- Name: idx_knowledge_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_created_by ON public.knowledge_documents USING btree (created_by);


--
-- Name: idx_knowledge_published_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_published_created ON public.knowledge_documents USING btree (is_published, created_at DESC);


--
-- Name: idx_knowledge_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_search ON public.knowledge_documents USING gin (search_vector);


--
-- Name: idx_pr_history_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_history_request_id ON public.purchase_request_status_history USING btree (purchase_request_id, created_at DESC);


--
-- Name: idx_purchase_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_created_at ON public.purchase_requests USING btree (created_at DESC);


--
-- Name: idx_purchase_requests_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_order_type ON public.purchase_requests USING btree (order_type);


--
-- Name: idx_purchase_requests_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_reference ON public.purchase_requests USING btree (reference_number);


--
-- Name: idx_purchase_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_requester ON public.purchase_requests USING btree (lower((requester_name)::text));


--
-- Name: idx_purchase_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_status ON public.purchase_requests USING btree (status);


--
-- Name: admin_users trg_admin_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: knowledge_documents trg_knowledge_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_knowledge_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_requests trg_purchase_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attachments attachments_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: knowledge_documents knowledge_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: purchase_request_status_history purchase_request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: purchase_request_status_history purchase_request_status_history_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict LH8l45fJxiUWVbhrAa1DgEmWV8RWNqcyl9H8zAWz1ZHL5OTKm5WX0tlYjBt47Id


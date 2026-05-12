from __future__ import annotations

import copy
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from mock_data import (
    WORKFLOW_STATUSES,
    data_sources,
    product_keywords,
    pain_points,
    main_images,
    scene_images,
    storyboard_frames,
    ad_keywords,
    infringement_words,
    category_recs,
    bullet_points,
    inventory_items,
    restock_suggestions,
    competitor_keywords,
    competitors,
    ad_positions,
    paginate,
    gen_id,
    now_iso,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("/status")
async def get_workflow_statuses():
    return {"success": True, "data": copy.deepcopy(WORKFLOW_STATUSES)}


# --- Product Research ---

@router.get("/product-research/data-sources")
async def get_data_sources():
    return {"success": True, "data": copy.deepcopy(data_sources)}


@router.get("/product-research/keywords")
async def get_product_keywords(
    aiTag: Optional[str] = Query(None),
    minVolume: Optional[int] = Query(None),
    sort: Optional[str] = Query(None),
    order: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    result = copy.deepcopy(product_keywords)
    if aiTag:
        result = [k for k in result if k["aiTag"] == aiTag]
    if minVolume:
        result = [k for k in result if k["volume"] >= minVolume]
    if search:
        q = search.lower()
        result = [k for k in result if q in k["keyword"].lower()]
    if sort:
        reverse = order == "desc"
        result.sort(key=lambda k: k.get(sort, 0), reverse=reverse)
    return {"success": True, "data": result}


@router.get("/product-research/pain-points")
async def get_pain_points():
    return {"success": True, "data": copy.deepcopy(pain_points)}


@router.post("/product-research/execute")
async def execute_product_research():
    return {
        "success": True,
        "data": {"taskId": gen_id("task"), "status": "started", "estimatedTime": "15 minutes"},
    }


# --- AI Imaging ---

@router.get("/ai-imaging/images")
async def get_images(type: Optional[str] = Query(None)):
    if type == "主图":
        return {"success": True, "data": copy.deepcopy(main_images)}
    elif type == "场景图":
        return {"success": True, "data": copy.deepcopy(scene_images)}
    return {"success": True, "data": copy.deepcopy(main_images + scene_images)}


@router.patch("/ai-imaging/images/{image_id}")
async def update_image(image_id: str, body: dict):
    all_images = main_images + scene_images
    image = next((i for i in all_images if i["id"] == image_id), None)
    if not image:
        raise HTTPException(status_code=404, detail=f"Image {image_id} not found")
    for key in ["clipScore", "ctrScore", "overall", "isBest", "prompt"]:
        if key in body:
            image[key] = body[key]
    return {"success": True, "data": copy.deepcopy(image)}


@router.get("/ai-imaging/storyboard")
async def get_storyboard():
    return {"success": True, "data": copy.deepcopy(storyboard_frames)}


@router.post("/ai-imaging/generate")
async def generate_image():
    return {
        "success": True,
        "data": {"imageId": gen_id("img"), "status": "generating", "estimatedTime": "30 seconds"},
    }


# --- AI Advertising ---

@router.get("/ai-advertising/keywords")
async def get_ad_keywords(
    tag: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: Optional[str] = Query(None),
):
    result = copy.deepcopy(ad_keywords)
    if tag:
        result = [k for k in result if k["tag"] == tag]
    if type:
        result = [k for k in result if k["type"] == type]
    if search:
        q = search.lower()
        result = [k for k in result if q in k["keyword"].lower()]
    if sort:
        reverse = order == "desc"
        result.sort(key=lambda k: k.get(sort, 0), reverse=reverse)
    return {"success": True, "data": result}


@router.patch("/ai-advertising/keywords/{keyword_id}")
async def update_ad_keyword(keyword_id: str, body: dict):
    kw = next((k for k in ad_keywords if k["id"] == keyword_id), None)
    if not kw:
        raise HTTPException(status_code=404, detail=f"Keyword {keyword_id} not found")
    for key in ["impressions", "clicks", "spend", "sales", "acos", "conversion", "cpc", "tag"]:
        if key in body:
            kw[key] = body[key]
    return {"success": True, "data": copy.deepcopy(kw)}


@router.post("/ai-advertising/export")
async def export_ad_keywords():
    return {"success": True, "data": {"format": "csv", "recordCount": len(ad_keywords), "status": "ready"}}


# --- AI Listing ---

@router.get("/ai-listing/infringement")
async def get_infringement():
    return {"success": True, "data": copy.deepcopy(infringement_words)}


@router.get("/ai-listing/categories")
async def get_categories():
    return {"success": True, "data": copy.deepcopy(category_recs)}


@router.get("/ai-listing/bullets")
async def get_bullet_points():
    return {"success": True, "data": copy.deepcopy(bullet_points)}


@router.post("/ai-listing/generate")
async def generate_listing():
    return {
        "success": True,
        "data": {"listingId": gen_id("lst"), "status": "generating", "estimatedTime": "2 minutes"},
    }


@router.post("/ai-listing/publish")
async def publish_listing():
    return {"success": True, "data": {"status": "published", "publishedAt": now_iso()}}


# --- Inventory ---

@router.get("/inventory")
async def get_inventory(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(20),
):
    result = copy.deepcopy(inventory_items)
    if status:
        result = [i for i in result if i["status"] == status]
    if search:
        q = search.lower()
        result = [i for i in result if q in i["sku"].lower() or q in i["name"].lower()]
    if sort:
        reverse = order == "desc"
        result.sort(key=lambda i: i.get(sort, 0), reverse=reverse)
    paged = paginate(result, page, pageSize)
    return {"success": True, "data": paged["items"], "pagination": paged["pagination"]}


@router.get("/inventory/restock-suggestions")
async def get_restock_suggestions():
    return {"success": True, "data": copy.deepcopy(restock_suggestions)}


@router.post("/inventory/restock-order")
async def create_restock_order(body: dict):
    return {
        "success": True,
        "data": {
            "orderId": gen_id("PO"),
            "sku": body.get("sku", ""),
            "quantity": body.get("quantity", 0),
            "shipMethod": body.get("shipMethod", "Sea Freight"),
            "status": "created",
        },
    }


# --- Competitor Ads ---

@router.get("/competitor-ads/keywords")
async def get_competitor_keywords(type: Optional[str] = Query(None)):
    if type and type in competitor_keywords:
        return {"success": True, "data": copy.deepcopy(competitor_keywords[type])}
    return {"success": True, "data": copy.deepcopy(competitor_keywords)}


@router.get("/competitor-ads/competitors")
async def get_competitors():
    return {"success": True, "data": copy.deepcopy(competitors)}


@router.get("/competitor-ads/positions")
async def get_ad_positions():
    return {"success": True, "data": copy.deepcopy(ad_positions)}


@router.post("/competitor-ads/analyze")
async def analyze_competitor_ads():
    return {
        "success": True,
        "data": {
            "analysisId": gen_id("analysis"),
            "status": "started",
            "competitorsAnalyzed": len(competitors),
        },
    }
